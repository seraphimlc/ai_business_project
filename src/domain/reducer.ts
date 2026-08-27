import { createInitialState } from './fixtures';
import { isActionAuthorized, resolveActor, verifyActor, type VerifiedActor } from './permissions';
import type { Actor, AuditLog, CandidateResult, DomainAction, DomainState, Inquiry, ObjectType, Product, ScopedRecord, Task } from './types';

export class DomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

const now = '2026-08-27T02:00:00.000Z';
const fail = (code: string, message: string): never => { throw new DomainError(code, `${code}: ${message}`); };
const forbiddenWritebackFields = new Set(['status', 'organizationId', 'projectId', 'createdAt', 'updatedAt']);
const writebackFields: Partial<Record<ObjectType, readonly string[]>> = {
  Organization: ['name'], User: ['name'], Role: ['name'], PartyCompany: ['name'], Contact: ['name', 'email'], Product: ['name', 'description', 'ownerId'], SKU: ['code'], ProductAttribute: ['name', 'value'], ProductAsset: ['kind', 'fileAssetId'], ProductVersion: ['description'], ChannelListing: ['channel'], Lead: ['name', 'companyId', 'ownerId'], CustomerProfile: ['summary', 'companyId'], TouchTask: ['ownerId'], FollowUp: ['ownerId'], Opportunity: ['name', 'ownerId'], Inquiry: ['summary', 'customerId'], MatchResult: ['selectedObjectId'], ServiceRequest: ['providerId'], LogisticsQuote: ['amount'], Quotation: [], QuotationVersion: ['amount', 'combination'], ComplianceCase: ['scope'], RiskItem: ['title'], RectificationTask: ['ownerId'], ComplianceMaterial: ['fileAssetId'], ReviewRecord: ['reviewerId'], Order: ['customerId'], FulfillmentNode: ['name'], RiskEvent: [], Inventory: ['quantity'], InboundRecord: ['quantity'], Report: ['title'], DataTask: ['name'], RuleConfiguration: ['name', 'version'], Task: ['title'], Notification: ['title'], FileAsset: ['name'], IntegrationRecord: ['responseSummary'],
};

function clone(state: DomainState): DomainState { return structuredClone(state); }

function authorize(state: DomainState, supplied: Actor): VerifiedActor {
  const resolved = resolveActor(state, supplied.userId);
  if (!resolved) return fail('ACTOR_NOT_AUTHORIZED', '用户、角色或项目成员关系无效');
  if (resolved.organizationId !== supplied.organizationId || resolved.role !== supplied.role || resolved.projectIds.length !== supplied.projectIds.length || resolved.projectIds.some((id) => !supplied.projectIds.includes(id))) {
    fail('ORGANIZATION_SCOPE_DENIED', '调用方上下文与授权范围不一致');
  }
  return verifyActor(state, supplied) ?? fail('ACTOR_NOT_AUTHORIZED', '授权上下文校验失败');
}

function canAccess(actor: VerifiedActor, record: ScopedRecord): boolean {
  return actor.projectIds.includes(record.projectId) && (actor.role === 'platform_operator' || actor.organizationId === record.organizationId);
}

function findScoped<T extends ScopedRecord>(records: T[], id: string, actor: VerifiedActor): T {
  const record = records.find((item) => item.id === id);
  if (!record) return fail('NOT_FOUND', `找不到记录 ${id}`);
  if (!canAccess(actor, record)) fail('ORGANIZATION_SCOPE_DENIED', '没有该组织或项目的数据权限');
  return record;
}

function assertCanOperate(actor: VerifiedActor): void {
  if (actor.role === 'service_provider') fail('ROLE_ACTION_DENIED', '服务商只能处理被分配的对象');
}

function hasAudit(state: DomainState, key?: string): boolean { return Boolean(key && state.auditLogs.some((item) => item.idempotencyKey === key)); }

function appendAudit(state: DomainState, actor: VerifiedActor, action: string, objectType: AuditLog['objectType'], objectId: string, before?: unknown, after?: unknown, idempotencyKey?: string, scope?: ScopedRecord): void {
  state.auditLogs.push({ id: `audit-${state.auditLogs.length + 1}`, organizationId: scope?.organizationId ?? actor.organizationId, projectId: scope?.projectId ?? actor.projectIds[0] ?? 'platform', createdAt: now, updatedAt: now, actorId: actor.userId, action, objectType, objectId, status: '已记录', before, after, idempotencyKey });
}

function addTask(state: DomainState, actor: VerifiedActor, task: Omit<Task, keyof ScopedRecord | 'status' | 'id'> & { status?: Task['status'] }, scope?: ScopedRecord): void {
  if (task.idempotencyKey && state.tasks.some((item) => item.idempotencyKey === task.idempotencyKey)) return;
  state.tasks.push({ ...task, id: `task-${state.tasks.length + 1}`, organizationId: scope?.organizationId ?? actor.organizationId, projectId: scope?.projectId ?? actor.projectIds[0] ?? 'platform', createdAt: now, updatedAt: now, status: task.status ?? '待处理' });
}

function markWritebackFailure(state: DomainState, candidate: CandidateResult, actor: VerifiedActor, key: string, message: string): DomainState {
  candidate.status = '写回失败'; candidate.updatedAt = now;
  addTask(state, actor, { title: '重试候选结果写回', kind: 'exception', objectType: candidate.targetObject.type, objectId: candidate.targetObject.id, assigneeId: actor.userId, idempotencyKey: `writeback-retry-${candidate.id}` }, candidate);
  appendAudit(state, actor, 'candidate.writeback-failed', candidate.targetObject.type, candidate.targetObject.id, undefined, { error: message }, key, candidate);
  return state;
}

function productComplianceBlocked(state: DomainState, productId: string): boolean {
  const cases = state.complianceCases.filter((item) => item.subjectType === 'Product' && item.subjectId === productId);
  return cases.some((item) => !complianceCaseComplete(state, item.id));
}

function complianceCaseComplete(state: DomainState, caseId: string): boolean {
  const risks = state.risks.filter((risk) => risk.caseId === caseId);
  const materials = state.complianceMaterials.filter((material) => material.caseId === caseId);
  const reviews = state.reviewRecords.filter((review) => review.caseId === caseId);
  return risks.length > 0 && risks.every((risk) => ['已解除', '已豁免', '已关闭'].includes(risk.status))
    && materials.length > 0 && materials.every((material) => material.status === '已确认')
    && reviews.length > 0 && reviews.every((review) => review.status === '通过');
}

function syncComplianceSubjectGate(state: DomainState, caseId: string): void {
  const item = state.complianceCases.find((candidate) => candidate.id === caseId);
  if (!item) return;
  if (item.subjectType === 'Product') {
    const product = state.products.find((candidate) => candidate.id === item.subjectId);
    if (product) product.status = productComplianceBlocked(state, product.id) ? '需整改' : '可经营';
  }
  if (item.subjectType === 'Order') {
    const order = state.orders.find((candidate) => candidate.id === item.subjectId);
    const blocked = state.complianceCases.some((candidate) => candidate.subjectType === 'Order' && candidate.subjectId === item.subjectId && !complianceCaseComplete(state, candidate.id));
    if (order && blocked) order.status = '履约异常';
    if (order && !blocked && order.status === '履约异常') order.status = '执行中';
  }
}

function applyProductGate(state: DomainState, product: Product, actor: VerifiedActor): void {
  const blocked = productComplianceBlocked(state, product.id);
  product.status = blocked ? '需整改' : '可经营';
  if (!blocked) addTask(state, actor, { title: '发布商品', kind: 'publish', objectType: 'Product', objectId: product.id, assigneeId: actor.userId, idempotencyKey: `publish-product-${product.id}` }, product);
}

function canConfirmTarget(actor: VerifiedActor, type: ObjectType): boolean {
  if (['enterprise_owner', 'platform_operator'].includes(actor.role)) return true;
  const roles: Partial<Record<ObjectType, readonly VerifiedActor['role'][]>> = {
    Product: ['product_operator'], Lead: ['sales_operator', 'product_operator'], CustomerProfile: ['sales_operator'],
    ComplianceCase: ['compliance_operator'], RiskItem: ['compliance_operator'], RectificationTask: ['compliance_operator'],
    Inquiry: ['sales_operator'], MatchResult: ['sales_operator', 'product_operator'], Quotation: ['sales_operator'],
    Order: ['fulfillment_operator'], FulfillmentNode: ['fulfillment_operator'], RiskEvent: ['fulfillment_operator'],
    Inventory: ['fulfillment_operator'], InboundRecord: ['fulfillment_operator'],
  };
  return roles[type]?.includes(actor.role) ?? false;
}

function validateCandidateMapping(candidate: CandidateResult, allowedFields: readonly string[]): boolean {
  return !Object.values(candidate.fieldMapping).some((field) => forbiddenWritebackFields.has(field) || !allowedFields.includes(field))
    && !Object.keys(candidate.fieldMapping).some((field) => !(field in candidate.payload));
}

function isFormalConfirmationAction(action: DomainAction): boolean {
  return action.type === 'confirmCandidate' || action.type === 'writebackObject' || action.type === 'retryWriteback';
}

const collectionByType: Partial<Record<ObjectType | 'VersionRecord', keyof DomainState>> = {
  Organization: 'organizations', User: 'users', Role: 'roles', ProjectMembership: 'projectMemberships', PartyCompany: 'partyCompanies', Contact: 'contacts',
  CustomerRelation: 'customerRelations', SupplierRelation: 'supplierRelations', ProviderRelation: 'providerRelations', Product: 'products', SKU: 'skus', ProductAttribute: 'productAttributes', ProductAsset: 'productAssets', ProductVersion: 'productVersions', ChannelListing: 'channelListings',
  Lead: 'leads', CustomerProfile: 'customerProfiles', TouchTask: 'touchTasks', FollowUp: 'followUps', Opportunity: 'opportunities', Inquiry: 'inquiries', MatchResult: 'matchResults', ServiceRequest: 'serviceRequests', LogisticsQuote: 'logisticsQuotes', Quotation: 'quotations', QuotationVersion: 'quotationVersions', ComplianceCase: 'complianceCases', RiskItem: 'risks', RectificationTask: 'rectificationTasks', ComplianceMaterial: 'complianceMaterials', ReviewRecord: 'reviewRecords', Order: 'orders', Fulfillment: 'fulfillments', FulfillmentNode: 'fulfillmentNodes', RiskEvent: 'riskEvents', Inventory: 'inventories', InboundRecord: 'inboundRecords', Report: 'reports', DataTask: 'dataTasks', RuleConfiguration: 'ruleConfigurations', SceneRun: 'sceneRuns', CandidateResult: 'candidates', Task: 'tasks', Notification: 'notifications', FileAsset: 'files', VersionRecord: 'versionRecords', AuditLog: 'auditLogs', IntegrationRecord: 'integrations',
};

function recordsFor(state: DomainState, type: ObjectType): ScopedRecord[] {
  const key = collectionByType[type];
  if (!key) return fail('TARGET_TYPE_UNSUPPORTED', `不支持对象类型 ${type}`);
  return state[key] as unknown as ScopedRecord[];
}

function updateSceneAfterCandidate(state: DomainState, candidate: CandidateResult): void {
  const scene = state.sceneRuns.find((item) => item.id === candidate.sceneRunId);
  if (scene) { scene.status = '已确认'; scene.updatedAt = now; }
}

function currentFormalVersion(state: DomainState, type: ObjectType, target: ScopedRecord): number {
  const record = target as ScopedRecord & { version?: unknown; currentVersion?: unknown };
  if (typeof record.currentVersion === 'number') return record.currentVersion;
  if (typeof record.version === 'number') return record.version;
  return state.versionRecords.filter((item) => item.objectType === type && item.objectId === target.id && item.status === '正式').reduce((max, item) => Math.max(max, item.version), 0);
}

function setFormalVersion(target: ScopedRecord, version: number): void {
  const record = target as ScopedRecord & { version?: unknown; currentVersion?: unknown };
  if (typeof record.currentVersion === 'number') record.currentVersion = version;
  else if (typeof record.version === 'number') record.version = version;
}

function writebackObject(state: DomainState, action: Extract<DomainAction, { type: 'writebackObject' }>, actor: VerifiedActor): DomainState {
  if (actor.role === 'service_provider') fail('SERVICE_PROVIDER_CANNOT_CONFIRM_FORMAL_DATA', '服务商不能确认企业正式数据');
  const candidate = findScoped(state.candidates, action.candidateId, actor);
  if (!canConfirmTarget(actor, candidate.targetObject.type)) fail('ROLE_ACTION_DENIED', '当前角色不能确认该业务对象');
  if (hasAudit(state, action.idempotencyKey)) return state;
  if (!['待确认', '写回失败'].includes(candidate.status)) fail('INVALID_TRANSITION', '候选结果当前不可写回');
  const allowedFields = writebackFields[candidate.targetObject.type];
  if (!allowedFields) return markWritebackFailure(state, candidate, actor, action.idempotencyKey, 'TARGET_TYPE_UNSUPPORTED');
  if (!validateCandidateMapping(candidate, allowedFields)) return markWritebackFailure(state, candidate, actor, action.idempotencyKey, 'WRITEBACK_FIELD_INVALID');
  let target: Record<string, unknown> & ScopedRecord;
  try { target = findScoped(recordsFor(state, candidate.targetObject.type), candidate.targetObject.id, actor) as Record<string, unknown> & ScopedRecord; } catch (error) { if (error instanceof DomainError) return markWritebackFailure(state, candidate, actor, action.idempotencyKey, error.code); throw error; }
  if (Object.values(candidate.fieldMapping).some((field) => !(field in target))) return markWritebackFailure(state, candidate, actor, action.idempotencyKey, 'WRITEBACK_FIELD_INVALID');
  const sourceVersion = currentFormalVersion(state, candidate.targetObject.type, target);
  if (sourceVersion !== candidate.sourceVersion) return markWritebackFailure(state, candidate, actor, action.idempotencyKey, 'SOURCE_VERSION_CONFLICT');
  const before: Record<string, unknown> = { version: sourceVersion };
  for (const [candidateKey, targetKey] of Object.entries(candidate.fieldMapping)) {
    if (!(targetKey in target)) return markWritebackFailure(state, candidate, actor, action.idempotencyKey, 'WRITEBACK_FIELD_INVALID');
    before[targetKey] = target[targetKey];
    target[targetKey] = candidate.payload[candidateKey];
  }
  target.updatedAt = now;
  setFormalVersion(target, sourceVersion + 1);
  if (candidate.targetObject.type === 'Product') {
    const product = target as unknown as Product;
    const currentVersion = state.productVersions.find((item) => item.productId === product.id && item.version === sourceVersion);
    if (currentVersion) currentVersion.status = '已废弃';
    state.productVersions.push({ id: `product-version-${product.id}-${product.currentVersion}`, organizationId: product.organizationId, projectId: product.projectId, createdAt: now, updatedAt: now, productId: product.id, version: product.currentVersion, description: product.description, status: '已生效', createdBy: actor.userId });
    applyProductGate(state, product, actor);
  }
  const priorVersions = state.versionRecords.filter((item) => item.objectType === candidate.targetObject.type && item.objectId === candidate.targetObject.id);
  const version = Math.max(sourceVersion, ...priorVersions.map((item) => item.version), 0) + 1;
  state.versionRecords.push({ id: `version-record-${state.versionRecords.length + 1}`, organizationId: target.organizationId, projectId: target.projectId, createdAt: now, updatedAt: now, objectType: candidate.targetObject.type, objectId: target.id, version, sourceCandidateId: candidate.id, status: '正式' });
  candidate.status = '已确认'; candidate.confirmedBy = actor.userId; candidate.confirmedAt = now; candidate.updatedAt = now;
  updateSceneAfterCandidate(state, candidate);
  appendAudit(state, actor, candidate.targetObject.type === 'Product' ? 'candidate.confirmed' : 'candidate.written-back', candidate.targetObject.type, target.id, before, candidate.payload, action.idempotencyKey, target);
  const retryTask = state.tasks.find((item) => item.idempotencyKey === `writeback-retry-${candidate.id}`);
  if (retryTask) { retryTask.status = '已完成'; retryTask.updatedAt = now; }
  const kind = candidate.targetObject.type === 'Lead' ? 'follow_up' : 'confirmation';
  addTask(state, actor, { title: candidate.targetObject.type === 'Lead' ? '跟进已入库线索' : '处理正式业务结果', kind, objectType: candidate.targetObject.type, objectId: target.id, assigneeId: actor.userId, idempotencyKey: candidate.targetObject.type === 'Lead' ? `lead-follow-up-${target.id}` : `writeback-${candidate.id}` }, target);
  return state;
}

function retryWriteback(state: DomainState, action: Extract<DomainAction, { type: 'retryWriteback' }>, actor: VerifiedActor): DomainState {
  const candidate = findScoped(state.candidates, action.candidateId, actor);
  if (!canConfirmTarget(actor, candidate.targetObject.type)) fail('ROLE_ACTION_DENIED', '当前角色不能确认该业务对象');
  if (candidate.status !== '写回失败') fail('INVALID_TRANSITION', '只有写回失败的候选结果可以重试');

  // A retry is a new confirmation attempt. If a repaired mapping omits a value,
  // preserve the current formal value rather than writing undefined into data.
  const target = findScoped(recordsFor(state, candidate.targetObject.type), candidate.targetObject.id, actor);
  const payload = { ...(action.payload ?? candidate.payload) };
  for (const candidateKey of Object.keys(candidate.fieldMapping)) {
    if (!(candidateKey in payload)) {
      const targetKey = candidate.fieldMapping[candidateKey];
      payload[candidateKey] = (target as unknown as Record<string, unknown>)[targetKey];
    }
  }
  candidate.payload = payload;
  candidate.candidateVersion += 1;
  candidate.status = '待确认';
  candidate.updatedAt = now;
  return writebackObject(state, { type: 'writebackObject', actor, candidateId: candidate.id, idempotencyKey: action.idempotencyKey }, actor);
}

function confirmCandidate(state: DomainState, action: Extract<DomainAction, { type: 'confirmCandidate' }>, actor: VerifiedActor): DomainState {
  if (actor.role === 'service_provider') fail('SERVICE_PROVIDER_CANNOT_CONFIRM_FORMAL_DATA', '服务商不能确认企业正式数据');
  const candidate = findScoped(state.candidates, action.candidateId, actor);
  if (!canConfirmTarget(actor, candidate.targetObject.type)) fail('ROLE_ACTION_DENIED', '当前角色不能确认该业务对象');
  if (hasAudit(state, action.idempotencyKey)) return state;
  if (candidate.status !== '待确认') fail('INVALID_TRANSITION', '候选结果当前不可确认');
  const target = findScoped(recordsFor(state, candidate.targetObject.type), candidate.targetObject.id, actor);
  if (currentFormalVersion(state, candidate.targetObject.type, target) !== candidate.sourceVersion) fail('SOURCE_VERSION_CONFLICT', '正式数据已更新，请基于最新版本重新确认');
  return writebackObject(state, { type: 'writebackObject', actor, candidateId: action.candidateId, idempotencyKey: action.idempotencyKey }, actor);
}

function leadEvent(state: DomainState, action: Extract<DomainAction, { type: 'leadEvent' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor);
  if (hasAudit(state, action.idempotencyKey)) return state;
  const lead = findScoped(state.leads, action.leadId, actor);
  const before = lead.status;
  if (action.event === 'confirm' && lead.status === '待筛选') lead.status = '处理中';
  else if (action.event === 'processing_complete' && lead.status === '处理中') lead.status = '待确认';
  else if (action.event === 'store' && lead.status === '待确认') {
    lead.status = '已入库';
    const profile = state.customerProfiles.find((item) => item.companyId === lead.companyId);
    if (profile) profile.status = '有效';
    addTask(state, actor, { title: '分配线索负责人', kind: 'confirmation', objectType: 'Lead', objectId: lead.id, assigneeId: actor.userId, idempotencyKey: `lead-assign-${lead.id}` }, lead);
  } else if (action.event === 'assign' && lead.status === '已入库') {
    lead.status = '已分配'; lead.ownerId = actor.userId;
    const touch = state.touchTasks.find((item) => item.leadId === lead.id); if (touch) { touch.ownerId = actor.userId; touch.status = '待执行'; }
    const followUp = state.followUps.find((item) => item.leadId === lead.id); if (followUp) followUp.ownerId = actor.userId;
  } else if (action.event === 'touch' && lead.status === '已分配') {
    lead.status = '已触达';
    const touch = state.touchTasks.find((item) => item.leadId === lead.id); if (touch) touch.status = '已发送';
    addTask(state, actor, { title: '记录客户跟进', kind: 'follow_up', objectType: 'Lead', objectId: lead.id, assigneeId: lead.ownerId ?? actor.userId, idempotencyKey: `lead-follow-up-${lead.id}` }, lead);
  } else if (action.event === 'follow_up' && lead.status === '已触达') {
    lead.status = '跟进中';
    const followUp = state.followUps.find((item) => item.leadId === lead.id); if (followUp) followUp.status = '跟进中';
  } else if (action.event === 'convert' && lead.status === '跟进中') {
    const followUp = state.followUps.find((item) => item.leadId === lead.id); if (followUp) followUp.status = '已完成';
    if (!state.opportunities.some((item) => item.leadId === lead.id)) state.opportunities.push({ id: `opportunity-${state.opportunities.length + 1}`, organizationId: lead.organizationId, projectId: lead.projectId, createdAt: now, updatedAt: now, leadId: lead.id, name: `${lead.name}商机`, ownerId: lead.ownerId ?? actor.userId, status: '跟进中' });
  } else fail('INVALID_TRANSITION', `线索不能从${lead.status}执行${action.event}`);
  lead.updatedAt = now;
  appendAudit(state, actor, `lead.${action.event}`, 'Lead', lead.id, { status: before }, { status: lead.status }, action.idempotencyKey);
  return state;
}

function riskResolve(state: DomainState, action: Extract<DomainAction, { type: 'riskResolve' }>, actor: VerifiedActor): DomainState {
  if (actor.role === 'service_provider') fail('SERVICE_PROVIDER_CANNOT_CONFIRM_FORMAL_DATA', '服务商不能确认企业正式数据');
  const risk = findScoped(state.risks, action.riskId, actor);
  if (risk.status !== '待复核') fail('INVALID_TRANSITION', '风险必须处于待复核才能解除');
  const rectification = state.rectificationTasks.find((item) => item.riskId === risk.id);
  const reviewCase = state.complianceCases.find((item) => item.id === risk.caseId);
  const reviews = state.reviewRecords.filter((item) => item.caseId === risk.caseId);
  const caseRisks = state.risks.filter((item) => item.caseId === risk.caseId);
  const materials = state.complianceMaterials.filter((item) => item.caseId === risk.caseId);
  if (!rectification || rectification.status !== '待复核' || !reviews.length || reviews.some((item) => item.status !== '待复核') || !reviewCase || reviewCase.status !== '待复核' || caseRisks.some((item) => item.status !== '待复核' && !['已解除', '已豁免', '已关闭'].includes(item.status)) || materials.some((item) => item.status !== '已确认')) return fail('PREREQUISITE_MISSING', '案件所有风险、材料和复核前置条件未完成');
  for (const item of caseRisks) item.status = '已解除';
  rectification.status = '已通过'; reviews.forEach((item) => { item.status = '通过'; }); reviewCase.status = '已通过';
  syncComplianceSubjectGate(state, reviewCase.id);
  const task = state.tasks.find((item) => item.id === 'task-provider-risk'); if (task) task.status = '已完成';
  addTask(state, actor, { title: '通知合规通过结果', kind: 'confirmation', objectType: 'ComplianceCase', objectId: reviewCase.id, assigneeId: actor.userId, idempotencyKey: `compliance-approved-${reviewCase.id}` }, reviewCase);
  const productSubject = reviewCase.subjectType === 'Product' ? state.products.find((item) => item.id === reviewCase.subjectId) : undefined;
  state.notifications.push({ id: `notification-${state.notifications.length + 1}`, organizationId: reviewCase.organizationId, projectId: reviewCase.projectId, createdAt: now, updatedAt: now, recipientId: productSubject?.ownerId ?? actor.userId, title: '合规案件已通过', status: '待发送', idempotencyKey: `compliance-approved-${reviewCase.id}` });
  appendAudit(state, actor, 'risk.resolved', 'RiskItem', risk.id, { status: '待复核' }, { status: risk.status });
  appendAudit(state, actor, 'compliance.approved', 'ComplianceCase', reviewCase.id, { status: '待复核' }, { status: reviewCase.status });
  return state;
}

function quotationVersion(state: DomainState, quotationId: string, amount: number, combination: string[], actor: VerifiedActor, idempotencyKey: string, revise: boolean): DomainState {
  if (hasAudit(state, idempotencyKey)) return state;
  const quotation = findScoped(state.quotations, quotationId, actor);
  if (!Number.isFinite(amount) || amount < 0 || combination.length === 0) fail('QUOTATION_VERSION_INVALID', '报价版本金额和组合不能为空');
  const current = state.quotationVersions.filter((item) => item.quotationId === quotation.id).sort((a, b) => a.version - b.version).at(-1);
  if (revise && (!current || quotation.currentVersion !== current.version)) fail('VERSION_CONFLICT', '报价当前版本与版本记录不一致');
  const version = (current?.version ?? 0) + 1;
  if (current) current.status = '已废弃';
  quotation.currentVersion = version; quotation.amount = amount; quotation.combination = [...combination]; quotation.status = '草稿'; quotation.updatedAt = now;
  state.quotationVersions.push({ id: `quotation-version-${version}`, organizationId: quotation.organizationId, projectId: quotation.projectId, createdAt: now, updatedAt: now, quotationId: quotation.id, version, amount, combination: [...combination], status: '已生效' });
  appendAudit(state, actor, revise ? 'quotation.revised' : 'quotation.version-created', 'Quotation', quotation.id, { version: current?.version }, { version, amount, combination }, idempotencyKey);
  return state;
}

function createQuotationVersion(state: DomainState, action: Extract<DomainAction, { type: 'createQuotationVersion' | 'reviseQuotation' }>, actor: VerifiedActor): DomainState {
  return quotationVersion(state, action.quotationId, action.amount, action.combination, actor, action.idempotencyKey, action.type === 'reviseQuotation');
}

function complianceParentAfterChild(state: DomainState, caseId: string, actor: VerifiedActor): void {
  const item = state.complianceCases.find((candidate) => candidate.id === caseId);
  if (!item) return;
  const risks = state.risks.filter((risk) => risk.caseId === caseId);
  const materials = state.complianceMaterials.filter((material) => material.caseId === caseId);
  const reviews = state.reviewRecords.filter((review) => review.caseId === caseId);
  const complete = complianceCaseComplete(state, caseId);
  if (complete && !['已归档', '已关闭'].includes(item.status)) item.status = '已通过';
  else if (!complete && risks.some((risk) => !['已解除', '已豁免', '已关闭'].includes(risk.status))) item.status = '待整改';
  else if (!complete && materials.some((material) => material.status !== '已确认')) item.status = '待补充材料';
  else if (!complete && reviews.some((review) => review.status !== '通过')) item.status = '待复核';
  item.updatedAt = now;
  syncComplianceSubjectGate(state, caseId);
  void actor;
}

function quotationFeedback(state: DomainState, action: Extract<DomainAction, { type: 'quotationFeedback' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor);
  if (hasAudit(state, action.idempotencyKey)) return state;
  const quotation = findScoped(state.quotations, action.quotationId, actor);
  if (actor.role === 'customer') {
    const buyerPartyId = state.users.find((user) => user.id === actor.userId)?.partyCompanyId;
    const inquiry = state.inquiries.find((item) => item.id === quotation.inquiryId);
    if (!buyerPartyId || !inquiry || inquiry.customerId !== buyerPartyId) fail('CUSTOMER_SCOPE_DENIED', '客户只能反馈自己询价产生的报价');
    if (!['已发送', '客户已查看', '议价中'].includes(quotation.status)) fail('INVALID_TRANSITION', '报价当前不可由客户反馈');
  }
  const before = quotation.status;
  const allowed: Record<Extract<DomainAction, { type: 'quotationFeedback' }>['feedback'], string[]> = { viewed: ['已发送'], negotiating: ['客户已查看'], accepted: ['客户已查看', '议价中'], rejected: ['已发送', '客户已查看', '议价中'] };
  if (!allowed[action.feedback].includes(quotation.status)) fail('INVALID_TRANSITION', `报价不能从${quotation.status}接收${action.feedback}`);
  quotation.status = ({ viewed: '客户已查看', negotiating: '议价中', accepted: '已接受', rejected: '已拒绝' } as const)[action.feedback];
  state.quotationFeedbacks.push({ id: `quotation-feedback-${state.quotationFeedbacks.length + 1}`, organizationId: quotation.organizationId, projectId: quotation.projectId, createdAt: now, updatedAt: now, quotationId: quotation.id, feedback: action.feedback });
  // 客户反馈产生的商家侧任务和通知不挂在客户名下。
  const sellerAssignee = actor.role === 'customer' ? 'user-enterprise-owner' : actor.userId;
  const notifySeller = (title: string) => {
    state.notifications.push({ id: `notification-${state.notifications.length + 1}`, organizationId: quotation.organizationId, projectId: quotation.projectId, createdAt: now, updatedAt: now, recipientId: sellerAssignee, title, status: '已发送', idempotencyKey: `feedback-notify-${action.idempotencyKey}` });
  };
  if (action.feedback === 'negotiating') {
    addTask(state, actor, { title: '跟进客户报价反馈', kind: 'follow_up', objectType: 'Quotation', objectId: quotation.id, assigneeId: sellerAssignee, idempotencyKey: `quotation-follow-up-${quotation.id}` }, quotation);
    notifySeller(`客户希望议价${action.targetAmount ? `，目标价 ${action.targetAmount}` : ''}，请跟进`);
  }
  if (action.feedback === 'accepted') {
    if (!state.opportunities.some((item) => item.quotationId === quotation.id)) state.opportunities.push({ id: `opportunity-${state.opportunities.length + 1}`, organizationId: quotation.organizationId, projectId: quotation.projectId, createdAt: now, updatedAt: now, quotationId: quotation.id, name: '已接受报价商机', ownerId: sellerAssignee, status: '新建' });
    addTask(state, actor, { title: '确认是否创建订单', kind: 'confirmation', objectType: 'Quotation', objectId: quotation.id, assigneeId: sellerAssignee, idempotencyKey: `quotation-order-next-${quotation.id}` }, quotation);
    notifySeller('客户已接受报价，请确认是否创建订单');
  }
  if (action.feedback === 'rejected') notifySeller('客户已拒绝报价');
  appendAudit(state, actor, `quotation.${action.feedback}`, 'Quotation', quotation.id, { status: before }, { status: quotation.status, comment: action.comment }, action.idempotencyKey);
  return state;
}

function transition(state: DomainState, actor: VerifiedActor, record: ScopedRecord & { status: string }, allowed: Record<string, string[]>, event: string, idempotencyKey?: string): void {
  if (idempotencyKey && hasAudit(state, idempotencyKey)) return;
  const next = allowed[event]?.[0];
  if (!next || !allowed[event].includes(record.status)) fail('INVALID_TRANSITION', `对象不能从${record.status}执行${event}`);
  const before = record.status; record.status = next; record.updatedAt = now;
  appendAudit(state, actor, `${record.id}.${event}`, 'Task', record.id, { status: before }, { status: next }, idempotencyKey);
}

function complianceCaseEvent(state: DomainState, action: Extract<DomainAction, { type: 'complianceCaseEvent' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor); const item = findScoped(state.complianceCases, action.caseId, actor);
  const next: Record<typeof action.event, string[]> = { accept: ['待受理'], request_materials: ['处理中'], request_rectification: ['处理中', '待补充材料'], submit_review: ['待整改'], approve: ['待复核'], archive: ['已通过'] };
  if (!next[action.event].includes(item.status)) fail('INVALID_TRANSITION', '合规案件状态不允许该事件');
  if (action.event === 'approve') {
    if (!complianceCaseComplete(state, item.id)) fail('PREREQUISITE_MISSING', '案件风险、材料和复核尚未全部完成');
  }
  const statuses: Record<typeof action.event, typeof item.status> = { accept: '处理中', request_materials: '待补充材料', request_rectification: '待整改', submit_review: '待复核', approve: '已通过', archive: '已归档' };
  const before = item.status; item.status = statuses[action.event]; item.updatedAt = now;
  if (action.event === 'request_rectification') state.risks.filter((risk) => risk.caseId === item.id && risk.status === '已确认').forEach((risk) => { risk.status = '整改中'; });
  if (action.event === 'submit_review') state.reviewRecords.filter((review) => review.caseId === item.id && review.status === '退回').forEach((review) => { review.status = '待复核'; });
  if (action.event === 'approve' || action.event === 'archive') {
    syncComplianceSubjectGate(state, item.id);
  }
  appendAudit(state, actor, `compliance-case.${action.event}`, 'ComplianceCase', item.id, { status: before }, { status: item.status }, action.idempotencyKey);
  return state;
}

function complianceMaterialEvent(state: DomainState, action: Extract<DomainAction, { type: 'complianceMaterialEvent' }>, actor: VerifiedActor): DomainState {
  const assignedCaseIds = actor.role === 'service_provider' ? state.rectificationTasks.filter((task) => task.ownerId === actor.userId).map((task) => state.risks.find((risk) => risk.id === task.riskId)?.caseId).filter((id): id is string => Boolean(id)) : [];
  const item = actor.role === 'service_provider' ? state.complianceMaterials.find((candidate) => candidate.id === action.materialId && assignedCaseIds.includes(candidate.caseId) && actor.projectIds.includes(candidate.projectId)) : findScoped(state.complianceMaterials, action.materialId, actor);
  if (!item) return fail('TASK_OWNER_REQUIRED', '服务商只能提交已分配案件的材料结果');
  if (actor.role === 'service_provider' && ['confirm', 'invalidate'].includes(action.event)) return fail('SERVICE_PROVIDER_CANNOT_CONFIRM_FORMAL_DATA', '服务商不能确认或作废企业正式材料');
  const next: Record<typeof action.event, string[]> = { start_upload: ['待上传'], submit: ['上传中', '待补充'], confirm: ['已提交'], request_more: ['已提交', '识别失败'], invalidate: ['已提交', '已确认'] }; const statuses: Record<typeof action.event, typeof item.status> = { start_upload: '上传中', submit: '已提交', confirm: '已确认', request_more: '待补充', invalidate: '已作废' };
  if (!next[action.event].includes(item.status)) fail('INVALID_TRANSITION', '合规材料状态不允许该事件'); const before = item.status; item.status = statuses[action.event]; item.updatedAt = now; complianceParentAfterChild(state, item.caseId, actor); appendAudit(state, actor, `compliance-material.${action.event}`, 'ComplianceMaterial', item.id, { status: before }, { status: item.status }, action.idempotencyKey); return state;
}

function riskItemEvent(state: DomainState, action: Extract<DomainAction, { type: 'riskItemEvent' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor); const item = findScoped(state.risks, action.riskId, actor); const next: Record<typeof action.event, string[]> = { confirm: ['待确认'], start_rectification: ['已确认'], submit_review: ['整改中'], resolve: ['待复核'], waive: ['已确认', '待复核'], close: ['已解除', '已豁免'] }; const statuses: Record<typeof action.event, typeof item.status> = { confirm: '已确认', start_rectification: '整改中', submit_review: '待复核', resolve: '已解除', waive: '已豁免', close: '已关闭' };
  if (!next[action.event].includes(item.status)) fail('INVALID_TRANSITION', '风险项状态不允许该事件'); const before = item.status; item.status = statuses[action.event]; item.updatedAt = now; complianceParentAfterChild(state, item.caseId, actor); appendAudit(state, actor, `risk-item.${action.event}`, 'RiskItem', item.id, { status: before }, { status: item.status }, action.idempotencyKey); return state;
}

function rectificationTaskEvent(state: DomainState, action: Extract<DomainAction, { type: 'rectificationTaskEvent' }>, actor: VerifiedActor): DomainState {
  const item = actor.role === 'service_provider' ? state.rectificationTasks.find((candidate) => candidate.id === action.taskId && candidate.ownerId === actor.userId && actor.projectIds.includes(candidate.projectId)) : findScoped(state.rectificationTasks, action.taskId, actor);
  if (!item) return fail('TASK_OWNER_REQUIRED', '只有已分配给当前用户的整改任务可以处理');
  if (action.event === 'approve' && !['enterprise_owner', 'compliance_operator', 'platform_operator'].includes(actor.role)) fail('ROLE_ACTION_DENIED', '当前角色不能审批整改结果');
  if (action.event !== 'approve' && item.ownerId !== actor.userId) fail('TASK_OWNER_REQUIRED', '只有整改任务负责人可以处理该任务');
  const next: Record<typeof action.event, string[]> = { start: ['待处理'], submit: ['处理中'], review: ['待提交'], approve: ['待复核'], return: ['待复核'], cancel: ['待处理', '处理中'] };
  const statuses: Record<typeof action.event, typeof item.status> = { start: '处理中', submit: '待提交', review: '待复核', approve: '已通过', return: '已退回', cancel: '已取消' };
  if (!next[action.event].includes(item.status)) fail('INVALID_TRANSITION', '整改任务状态不允许该事件'); const before = item.status; item.status = statuses[action.event]; item.updatedAt = now; const risk = state.risks.find((candidate) => candidate.id === item.riskId); if (risk && action.event === 'submit') risk.status = '待复核'; if (risk && action.event === 'return') risk.status = '整改中'; if (risk) complianceParentAfterChild(state, risk.caseId, actor); appendAudit(state, actor, `rectification.${action.event}`, 'RectificationTask', item.id, { status: before }, { status: item.status }, action.idempotencyKey); return state;
}

function reviewRecordEvent(state: DomainState, action: Extract<DomainAction, { type: 'reviewRecordEvent' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor); const item = findScoped(state.reviewRecords, action.reviewId, actor); const next: Record<typeof action.event, string[]> = { approve: ['待复核'], return: ['待复核'], withdraw: ['通过', '退回'] }; const statuses: Record<typeof action.event, typeof item.status> = { approve: '通过', return: '退回', withdraw: '已撤回' };
  if (!next[action.event].includes(item.status)) fail('INVALID_TRANSITION', '复核记录状态不允许该事件'); const before = item.status; item.status = statuses[action.event]; item.updatedAt = now;
  if (action.event === 'return') {
    const parent = state.complianceCases.find((candidate) => candidate.id === item.caseId);
    if (parent) { parent.status = '待整改'; parent.updatedAt = now; addTask(state, actor, { title: '重新整改后提交复核', kind: 'risk_review', objectType: 'ComplianceCase', objectId: parent.id, assigneeId: actor.userId, idempotencyKey: `review-return-${item.id}` }, parent); }
  }
  complianceParentAfterChild(state, item.caseId, actor); appendAudit(state, actor, `review.${action.event}`, 'ReviewRecord', item.id, { status: before }, { status: item.status }, action.idempotencyKey); return state;
}

function inquiryEvent(state: DomainState, action: Extract<DomainAction, { type: 'inquiryEvent' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor); const item = findScoped(state.inquiries, action.inquiryId, actor); const next: Record<typeof action.event, string[]> = { process: ['草稿', '待确认'], request_more: ['处理中', '待确认'], confirm: ['待确认', '待补充'], close: ['已确认', '处理中', '待补充'] }; const statuses: Record<typeof action.event, typeof item.status> = { process: '处理中', request_more: '待补充', confirm: '已确认', close: '已关闭' };
  if (!next[action.event].includes(item.status)) fail('INVALID_TRANSITION', '询价状态不允许该事件'); const before = item.status; item.status = statuses[action.event]; item.updatedAt = now; appendAudit(state, actor, `inquiry.${action.event}`, 'Inquiry', item.id, { status: before }, { status: item.status }, action.idempotencyKey); return state;
}

function matchResultEvent(state: DomainState, action: Extract<DomainAction, { type: 'matchResultEvent' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor); const item = findScoped(state.matchResults, action.matchResultId, actor); const next: Record<typeof action.event, string[]> = { choose: ['待选择'], reject: ['处理中', '待选择'], expire: ['处理中', '待选择', '已选择'] }; const statuses: Record<typeof action.event, typeof item.status> = { choose: '已选择', reject: '已驳回', expire: '失效' };
  if (!next[action.event].includes(item.status)) fail('INVALID_TRANSITION', '匹配结果状态不允许该事件'); const before = item.status; item.status = statuses[action.event]; item.updatedAt = now; appendAudit(state, actor, `match.${action.event}`, 'MatchResult', item.id, { status: before }, { status: item.status }, action.idempotencyKey); return state;
}

function quotationEvent(state: DomainState, action: Extract<DomainAction, { type: 'quotationEvent' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor); const item = findScoped(state.quotations, action.quotationId, actor); const next: Record<typeof action.event, string[]> = { confirm: ['草稿', '待确认'], send: ['草稿', '待确认'], expire: ['已发送', '客户已查看', '议价中'], close: ['已拒绝', '已过期'] }; const statuses: Record<typeof action.event, typeof item.status> = { confirm: '待确认', send: '已发送', expire: '已过期', close: '已过期' };
  if (!next[action.event].includes(item.status)) fail('INVALID_TRANSITION', '报价状态不允许该事件'); const before = item.status; item.status = statuses[action.event]; item.updatedAt = now; appendAudit(state, actor, `quotation.${action.event}`, 'Quotation', item.id, { status: before }, { status: item.status }, action.idempotencyKey); return state;
}

function orderEvent(state: DomainState, action: Extract<DomainAction, { type: 'orderEvent' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor); const item = findScoped(state.orders, action.orderId, actor); const next: Record<typeof action.event, string[]> = { confirm: ['草稿', '待确认', '待补充信息'], start: ['已确认'], pause: ['执行中', '部分完成'], resume: ['已暂停'], cancel: ['草稿', '待确认', '已暂停'] }; const statuses: Record<typeof action.event, typeof item.status> = { confirm: '已确认', start: '执行中', pause: '已暂停', resume: '执行中', cancel: '已取消' };
  if (!next[action.event].includes(item.status)) fail('INVALID_TRANSITION', '订单状态不允许该事件'); const before = item.status; item.status = statuses[action.event]; item.updatedAt = now; appendAudit(state, actor, `order.${action.event}`, 'Order', item.id, { status: before }, { status: item.status }, action.idempotencyKey); return state;
}

function riskEventEvent(state: DomainState, action: Extract<DomainAction, { type: 'riskEventEvent' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor); const item = findScoped(state.riskEvents, action.riskEventId, actor); const next: Record<typeof action.event, string[]> = { start: ['新建'], submit_review: ['处理中'], resolve: ['待复核'], accept: ['处理中', '待复核'], close: ['已解除', '已接受'] }; const statuses: Record<typeof action.event, typeof item.status> = { start: '处理中', submit_review: '待复核', resolve: '已解除', accept: '已接受', close: '已关闭' };
  if (!next[action.event].includes(item.status)) fail('INVALID_TRANSITION', '风险事件状态不允许该事件'); const before = item.status; item.status = statuses[action.event]; item.updatedAt = now; appendAudit(state, actor, `risk-event.${action.event}`, 'RiskEvent', item.id, { status: before }, { status: item.status }, action.idempotencyKey); return state;
}

function inventoryEvent(state: DomainState, action: Extract<DomainAction, { type: 'inventoryEvent' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor); const item = findScoped(state.inventories, action.inventoryId, actor); const next: Record<typeof action.event, string[]> = { warn: ['可用'], freeze: ['可用', '预警'], start_count: ['可用', '预警', '冻结'], release: ['冻结', '盘点中'] }; const statuses: Record<typeof action.event, typeof item.status> = { warn: '预警', freeze: '冻结', start_count: '盘点中', release: '可用' };
  if (!next[action.event].includes(item.status)) fail('INVALID_TRANSITION', '库存状态不允许该事件'); const before = item.status; item.status = statuses[action.event]; item.updatedAt = now; appendAudit(state, actor, `inventory.${action.event}`, 'Inventory', item.id, { status: before }, { status: item.status }, action.idempotencyKey); return state;
}

function inboundRecordEvent(state: DomainState, action: Extract<DomainAction, { type: 'inboundRecordEvent' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor); const item = findScoped(state.inboundRecords, action.inboundRecordId, actor); const next: Record<typeof action.event, string[]> = { start_inspection: ['待入库'], partial: ['验收中'], complete: ['验收中', '部分入库'], exception: ['验收中', '部分入库'] }; const statuses: Record<typeof action.event, typeof item.status> = { start_inspection: '验收中', partial: '部分入库', complete: '已入库', exception: '异常' };
  if (!next[action.event].includes(item.status)) fail('INVALID_TRANSITION', '入库状态不允许该事件'); const before = item.status; item.status = statuses[action.event]; item.updatedAt = now; appendAudit(state, actor, `inbound.${action.event}`, 'InboundRecord', item.id, { status: before }, { status: item.status }, action.idempotencyKey); return state;
}

const fulfillmentTransitions: Record<string, string[]> = { '未开始': ['处理中', '已取消'], '处理中': ['待确认', '已完成', '存在风险', '已暂停', '已取消'], '待确认': ['已完成', '存在风险'], '存在风险': ['处理中', '已暂停', '已取消'], '已完成': [], '已暂停': ['处理中', '已取消'], '已取消': [] };

function updateFulfillmentNode(state: DomainState, action: Extract<DomainAction, { type: 'fulfillmentNodeEvent' }>, actor: VerifiedActor): DomainState {
  assertCanOperate(actor);
  if (hasAudit(state, action.idempotencyKey)) return state;
  const node = findScoped(state.fulfillmentNodes, action.nodeId, actor);
  if (action.orderId !== state.fulfillments.find((item) => item.id === node.fulfillmentId)?.orderId) return fail('RELATIONSHIP_INVALID', '动作订单与履约节点不匹配');
  const next: Record<Extract<DomainAction, { type: 'fulfillmentNodeEvent' }>['event'], typeof node.status> = { start: '处理中', submit: '待确认', confirm: '已完成', risk: '存在风险', resolve: '处理中', pause: '已暂停', cancel: '已取消', complete: '已完成' };
  const targetStatus = next[action.event];
  if (!fulfillmentTransitions[node.status].includes(targetStatus)) fail('INVALID_TRANSITION', `履约节点不能从${node.status}变为${targetStatus}`);
  const before = node.status; node.status = targetStatus; node.updatedAt = now;
  const fulfillment = state.fulfillments.find((item) => item.id === node.fulfillmentId); if (!fulfillment) return fail('RELATIONSHIP_INVALID', '履约单不存在');
  const order = state.orders.find((item) => item.id === fulfillment.orderId); if (!order) return fail('RELATIONSHIP_INVALID', '订单不存在');
  if (action.event === 'risk') {
    const riskEventId = action.riskEventId;
    if (!riskEventId) return fail('RELATIONSHIP_REQUIRED', '风险事件必须由动作明确指定');
    const existing = state.riskEvents.find((item) => item.id === riskEventId);
    if (existing && (existing.nodeId !== node.id || existing.orderId !== order.id)) fail('RELATIONSHIP_INVALID', '风险事件与履约节点或订单不匹配');
    if (!existing) state.riskEvents.push({ id: riskEventId, organizationId: node.organizationId, projectId: node.projectId, createdAt: now, updatedAt: now, orderId: order.id, nodeId: node.id, status: '新建' });
    fulfillment.status = '存在风险'; order.status = '履约异常';
    addTask(state, actor, { title: '处理履约风险', kind: 'risk_review', objectType: 'Order', objectId: order.id, assigneeId: actor.userId, idempotencyKey: `fulfillment-risk-${node.id}` }, order);
  } else if (action.event === 'resolve') {
    const riskEventId = action.riskEventId;
    if (!riskEventId) return fail('RELATIONSHIP_REQUIRED', '解除风险必须明确指定风险事件');
    const event = state.riskEvents.find((item) => item.id === riskEventId);
    if (!event || event.nodeId !== node.id || event.orderId !== order.id) return fail('RELATIONSHIP_INVALID', '风险事件与履约节点或订单不匹配');
    event.status = '已解除'; event.updatedAt = now;
  } else if (action.event === 'complete') {
    const inboundRecordId = action.inboundRecordId;
    const inventoryId = action.inventoryId;
    if (!inboundRecordId || !inventoryId) return fail('RELATIONSHIP_REQUIRED', '完成履约必须明确指定入库和库存记录');
    const inbound = state.inboundRecords.find((item) => item.id === inboundRecordId);
    const inventory = state.inventories.find((item) => item.id === inventoryId);
    if (!inbound || inbound.orderId !== order.id || !inventory) return fail('RELATIONSHIP_INVALID', '入库或库存记录与订单不匹配');
    if (action.riskEventId) {
      const event = state.riskEvents.find((item) => item.id === action.riskEventId);
      if (!event || event.nodeId !== node.id || event.orderId !== order.id) return fail('RELATIONSHIP_INVALID', '风险事件与履约节点或订单不匹配');
      event.status = '已关闭'; event.updatedAt = now;
    }
    inbound.status = '已入库'; inbound.updatedAt = now; inventory.quantity += inbound.quantity; inventory.status = '可用'; inventory.updatedAt = now;
    const allCompleted = state.fulfillmentNodes.filter((item) => item.fulfillmentId === fulfillment.id).every((item) => item.id === node.id ? targetStatus === '已完成' : item.status === '已完成');
    fulfillment.status = allCompleted ? '已完成' : '部分完成'; order.status = allCompleted ? '已完成' : '部分完成';
  } else if (action.event === 'start') {
    fulfillment.status = '处理中'; if (order.status === '履约异常') order.status = '执行中';
  }
  appendAudit(state, actor, 'fulfillment-node.updated', 'FulfillmentNode', node.id, { status: before }, { status: node.status }, action.idempotencyKey);
  return state;
}

export function domainReducer(current: DomainState, action: DomainAction): DomainState {
  if (action.type === 'resetDemo') return createInitialState();
  const state = clone(current);
  const actor = authorize(state, action.actor);
  if (actor.role === 'service_provider' && isFormalConfirmationAction(action)) {
    return fail('SERVICE_PROVIDER_CANNOT_CONFIRM_FORMAL_DATA', '服务商不能确认企业正式数据');
  }
  if (!isActionAuthorized(actor.role, action.type)) return fail('ROLE_ACTION_DENIED', '当前业务角色不能执行该领域动作');
  const trusted = { ...action, actor } as DomainAction;
  switch (trusted.type) {
    case 'createProductDraft': {
      assertCanOperate(actor);
      if (state.products.some((item) => item.id === trusted.productId)) fail('IDEMPOTENCY_CONFLICT', '商品编号已存在');
      const product: Product = { id: trusted.productId, organizationId: actor.organizationId, projectId: actor.projectIds[0], createdAt: now, updatedAt: now, name: trusted.name, description: '', ownerId: actor.userId, status: '草稿', currentVersion: 1 };
      state.products.push(product); appendAudit(state, actor, 'product.created', 'Product', product.id, undefined, { status: product.status }); return state;
    }
    case 'updateProductDraft': {
      assertCanOperate(actor);
      if (hasAudit(state, trusted.idempotencyKey)) return state;
      const product = findScoped(state.products, trusted.productId, actor);
      if (!['草稿', '待完善'].includes(product.status)) fail('INVALID_TRANSITION', '只有草稿或待完善商品可以直接编辑');
      const allowedFields = ['name', 'description', 'price', 'unit', 'category'] as const;
      const before: Record<string, unknown> = {};
      for (const key of allowedFields) {
        const value = trusted.fields[key];
        if (value === undefined) continue;
        before[key] = product[key];
        (product as unknown as Record<string, unknown>)[key] = value;
      }
      product.updatedAt = now;
      if (product.status === '草稿') product.status = '待完善';
      appendAudit(state, actor, 'product.draft-updated', 'Product', product.id, before, { ...trusted.fields }, trusted.idempotencyKey, product);
      return state;
    }
    case 'uploadProductAsset': {
      assertCanOperate(actor);
      const product = findScoped(state.products, trusted.productId, actor);
      if (hasAudit(state, trusted.idempotencyKey)) return state;
      if (state.files.some((item) => item.id === trusted.fileId) || state.productAssets.some((item) => item.id === trusted.assetId)) fail('IDEMPOTENCY_CONFLICT', '素材或文件编号已存在');
      state.files.push({ id: trusted.fileId, organizationId: product.organizationId, projectId: product.projectId, createdAt: now, updatedAt: now, name: trusted.name, status: '可用' });
      state.productAssets.push({ id: trusted.assetId, organizationId: product.organizationId, projectId: product.projectId, createdAt: now, updatedAt: now, productId: product.id, kind: trusted.kind, fileAssetId: trusted.fileId, status: '已确认' });
      appendAudit(state, actor, 'product.asset-uploaded', 'ProductAsset', trusted.assetId, undefined, { productId: product.id, kind: trusted.kind, name: trusted.name }, trusted.idempotencyKey, product);
      return state;
    }
    case 'publishProduct': {
      assertCanOperate(actor);
      if (hasAudit(state, trusted.idempotencyKey)) return state;
      const product = findScoped(state.products, trusted.productId, actor);
      if (product.status === '已停用') fail('INVALID_TRANSITION', '已停用商品不能发布');
      const channel = trusted.channel ?? '跨境商城';
      const existing = state.channelListings.find((item) => item.productId === product.id && item.channel === channel);
      if (!existing) {
        state.channelListings.push({ id: `listing-${product.id}-${channel}`, organizationId: product.organizationId, projectId: product.projectId, createdAt: now, updatedAt: now, productId: product.id, channel, status: '已发布' });
      }
      const blocked = productComplianceBlocked(state, product.id);
      product.status = blocked ? '需整改' : '可经营';
      product.updatedAt = now;
      const publishTask = state.tasks.find((item) => item.objectType === 'Product' && item.objectId === product.id && item.kind === 'publish' && item.assigneeId === actor.userId && item.status !== '已完成');
      if (publishTask) { publishTask.status = '已完成'; publishTask.updatedAt = now; }
      appendAudit(state, actor, 'product.published', 'ChannelListing', existing?.id ?? `listing-${product.id}-${channel}`, { status: product.status }, { channel, published: true }, trusted.idempotencyKey, product);
      return state;
    }
    case 'processProductContent': {
      assertCanOperate(actor);
      const product = findScoped(state.products, trusted.productId, actor);
      if (product.status !== '待完善') fail('INVALID_TRANSITION', '只有待完善商品可以提交内容处理');
      if (hasAudit(state, trusted.idempotencyKey)) return state;
      if (state.sceneRuns.some((item) => item.id === trusted.sceneRunId) || state.candidates.some((item) => item.id === trusted.candidateId)) fail('IDEMPOTENCY_CONFLICT', '场景或候选编号已存在');
      state.sceneRuns.push({ id: trusted.sceneRunId, organizationId: product.organizationId, projectId: product.projectId, createdAt: now, updatedAt: now, sceneType: 'product-content', initiatedBy: actor.userId, targetObject: { type: 'Product', id: product.id }, status: '待确认', sourceEndpoint: 'H5' });
      state.candidates.push({ id: trusted.candidateId, organizationId: product.organizationId, projectId: product.projectId, createdAt: now, updatedAt: now, sceneRunId: trusted.sceneRunId, targetObject: { type: 'Product', id: product.id }, sourceVersion: trusted.sourceVersion, candidateVersion: 1, payload: trusted.payload, sourcePayload: structuredClone(trusted.payload), fieldMapping: Object.fromEntries(Object.keys(trusted.payload).map((key) => [key, key])), status: '待确认', idempotencyKey: trusted.idempotencyKey });
      addTask(state, actor, { title: '确认商品内容候选', kind: 'confirmation', objectType: 'Product', objectId: product.id, assigneeId: actor.userId, idempotencyKey: `confirm-${trusted.candidateId}` }, product);
      appendAudit(state, actor, 'product.content-processed', 'SceneRun', trusted.sceneRunId, { status: '处理中' }, { status: '待确认' }, trusted.idempotencyKey, product);
      return state;
    }
    case 'startScene': {
      assertCanOperate(actor); const target = findScoped(recordsFor(state, trusted.targetObject.type), trusted.targetObject.id, actor);
      if (state.sceneRuns.some((item) => item.id === trusted.sceneRunId)) fail('IDEMPOTENCY_CONFLICT', '场景处理记录已存在');
      state.sceneRuns.push({ id: trusted.sceneRunId, organizationId: target.organizationId, projectId: target.projectId, createdAt: now, updatedAt: now, sceneType: trusted.sceneType, initiatedBy: actor.userId, targetObject: trusted.targetObject, status: '处理中', sourceEndpoint: trusted.sourceEndpoint ?? 'Web' });
      appendAudit(state, actor, 'scene.started', 'SceneRun', trusted.sceneRunId, { status: '未开始' }, { status: '处理中' }); return state;
    }
    case 'processingComplete': {
      const scene = findScoped(state.sceneRuns, trusted.sceneRunId, actor); if (hasAudit(state, trusted.idempotencyKey)) return state; if (scene.status !== '处理中') fail('INVALID_TRANSITION', '只有处理中场景可以产生候选结果');
      state.candidates.push({ id: trusted.candidateId, organizationId: scene.organizationId, projectId: scene.projectId, createdAt: now, updatedAt: now, sceneRunId: scene.id, targetObject: scene.targetObject, sourceVersion: trusted.sourceVersion, candidateVersion: 1, payload: trusted.payload, sourcePayload: structuredClone(trusted.payload), fieldMapping: Object.fromEntries(Object.keys(trusted.payload).map((key) => [key, key])), status: '待确认', idempotencyKey: trusted.idempotencyKey });
      scene.status = '待确认'; addTask(state, actor, { title: '确认候选结果', kind: 'confirmation', objectType: scene.targetObject.type, objectId: scene.targetObject.id, assigneeId: actor.userId, idempotencyKey: `confirm-${trusted.candidateId}` }, scene); appendAudit(state, actor, 'scene.processing-complete', 'SceneRun', scene.id, { status: '处理中' }, { status: scene.status }, trusted.idempotencyKey); return state;
    }
    case 'confirmCandidate': return confirmCandidate(state, trusted, actor);
    case 'writebackObject': return writebackObject(state, trusted, actor);
    case 'retryWriteback': return retryWriteback(state, trusted, actor);
    case 'rejectCandidate': { const candidate = findScoped(state.candidates, trusted.candidateId, actor); if (candidate.status !== '待确认') fail('INVALID_TRANSITION', '候选结果当前不可驳回'); candidate.status = '已驳回'; const scene = state.sceneRuns.find((item) => item.id === candidate.sceneRunId); if (scene) scene.status = '已驳回'; appendAudit(state, actor, 'candidate.rejected', candidate.targetObject.type, candidate.targetObject.id, { status: '待确认' }, { status: candidate.status }); return state; }
    case 'assignTask': { const task = findScoped(state.tasks, trusted.taskId, actor); if (!['enterprise_owner', 'platform_operator', 'compliance_operator'].includes(actor.role)) fail('ROLE_ACTION_DENIED', '当前角色不能分配任务'); const assignee = resolveActor(state, trusted.assigneeId); if (!assignee) return fail('ASSIGNEE_NOT_AUTHORIZED', '任务负责人不存在、未启用或没有有效项目成员关系'); if (assignee.organizationId !== task.organizationId || !assignee.projectIds.includes(task.projectId)) fail('ASSIGNEE_SCOPE_DENIED', '任务负责人不属于目标组织或项目'); task.assigneeId = assignee.userId; task.status = '待处理'; appendAudit(state, actor, 'task.assigned', 'Task', task.id, undefined, { assigneeId: task.assigneeId }); return state; }
    case 'completeTask': { const task = findScoped(state.tasks, trusted.taskId, actor); if (task.assigneeId !== actor.userId) fail('TASK_OWNER_REQUIRED', '只有任务负责人可以完成任务'); if (task.status === '已完成') return state; if (!['待处理', '处理中', '待确认', '待复核', '已退回'].includes(task.status)) fail('INVALID_TRANSITION', '任务当前不可完成'); task.status = '已完成'; appendAudit(state, actor, 'task.completed', 'Task', task.id, undefined, { status: task.status }); return state; }
    case 'returnTask': { const task = findScoped(state.tasks, trusted.taskId, actor); if (task.assigneeId !== actor.userId) fail('TASK_OWNER_REQUIRED', '只有任务负责人可以退回任务'); if (task.status === '已完成') fail('INVALID_TRANSITION', '已完成任务不能退回'); task.status = '已退回'; appendAudit(state, actor, 'task.returned', 'Task', task.id, undefined, { status: task.status, reason: trusted.reason }); return state; }
    case 'retryScene': { const scene = findScoped(state.sceneRuns, trusted.sceneRunId, actor); if (hasAudit(state, trusted.idempotencyKey)) return state; if (!['失败', '超时'].includes(scene.status)) fail('INVALID_TRANSITION', '只有失败或超时场景可以重试'); scene.status = '处理中'; appendAudit(state, actor, 'scene.retried', 'SceneRun', scene.id, undefined, { status: scene.status }, trusted.idempotencyKey); return state; }
    case 'markSceneFailure': { const scene = findScoped(state.sceneRuns, trusted.sceneRunId, actor); if (trusted.failure === 'rule_indeterminate') { if (scene.status !== '处理中') fail('INVALID_TRANSITION', '规则判断只能发生在处理中'); scene.status = '待确认'; addTask(state, actor, { title: '人工判断规则结果', kind: 'rule_review', objectType: scene.targetObject.type, objectId: scene.targetObject.id, assigneeId: actor.userId, idempotencyKey: `rule-review-${scene.id}` }, scene); } else { if (!['处理中', '待确认'].includes(scene.status)) fail('INVALID_TRANSITION', '当前场景不可标记失败'); scene.status = trusted.failure === 'timeout' ? '超时' : '失败'; addTask(state, actor, { title: trusted.failure === 'file' ? '重新提交文件' : '重试处理', kind: 'exception', objectType: 'SceneRun', objectId: scene.id, assigneeId: actor.userId, idempotencyKey: `${trusted.failure}-${scene.id}` }, scene); } appendAudit(state, actor, `scene.failure.${trusted.failure}`, 'SceneRun', scene.id, undefined, { status: scene.status, message: trusted.message }, undefined, scene); return state; }
    case 'leadEvent': return leadEvent(state, trusted, actor);
    case 'complianceCaseEvent': return complianceCaseEvent(state, trusted, actor);
    case 'complianceMaterialEvent': return complianceMaterialEvent(state, trusted, actor);
    case 'riskItemEvent': return riskItemEvent(state, trusted, actor);
    case 'rectificationTaskEvent': return rectificationTaskEvent(state, trusted, actor);
    case 'reviewRecordEvent': return reviewRecordEvent(state, trusted, actor);
    case 'inquiryEvent': return inquiryEvent(state, trusted, actor);
    case 'matchResultEvent': return matchResultEvent(state, trusted, actor);
    case 'quotationEvent': return quotationEvent(state, trusted, actor);
    case 'orderEvent': return orderEvent(state, trusted, actor);
    case 'riskResolve': return riskResolve(state, trusted, actor);
    case 'quotationFeedback': return quotationFeedback(state, trusted, actor);
    case 'createQuotationVersion': return createQuotationVersion(state, trusted, actor);
    case 'reviseQuotation': return createQuotationVersion(state, trusted, actor);
    case 'fulfillmentNodeEvent': return updateFulfillmentNode(state, trusted, actor);
    case 'riskEventEvent': return riskEventEvent(state, trusted, actor);
    case 'inventoryEvent': return inventoryEvent(state, trusted, actor);
    case 'inboundRecordEvent': return inboundRecordEvent(state, trusted, actor);
    case 'approveEnterpriseAdmission': {
      const org = findScoped(state.organizations, trusted.organizationId, actor);
      if (org.status !== '待审核') fail('INVALID_TRANSITION', '只有待审核企业可以完成入驻');
      org.status = '启用'; org.updatedAt = now;
      const party = state.partyCompanies.find((p) => p.organizationId === org.id);
      if (party && party.status === '草稿') { party.status = '有效'; party.updatedAt = now; }
      appendAudit(state, actor, 'enterprise.admission-approved', 'Organization', org.id, { status: '待审核' }, { status: '启用' }, trusted.idempotencyKey, org);
      return state;
    }
    case 'rejectEnterpriseAdmission': {
      const org = findScoped(state.organizations, trusted.organizationId, actor);
      if (org.status !== '待审核') fail('INVALID_TRANSITION', '只有待审核企业可以被驳回');
      org.status = '停用'; org.updatedAt = now;
      appendAudit(state, actor, 'enterprise.admission-rejected', 'Organization', org.id, { status: '待审核' }, { status: '停用', reason: trusted.reason }, trusted.idempotencyKey, org);
      return state;
    }
    case 'toggleProjectDomain': {
      const project = findScoped(state.platformProjects, trusted.projectId, actor);
      const has = project.enabledDomains.includes(trusted.domain);
      project.enabledDomains = has ? project.enabledDomains.filter((d) => d !== trusted.domain) : [...project.enabledDomains, trusted.domain];
      project.updatedAt = now;
      appendAudit(state, actor, has ? 'project.domain-disabled' : 'project.domain-enabled', 'PlatformProject', project.id, undefined, { domain: trusted.domain }, trusted.idempotencyKey, project);
      return state;
    }
    case 'assignServiceRequest': {
      const request = findScoped(state.serviceRequests, trusted.serviceRequestId, actor);
      if (!['草稿', '待受理', '匹配中', '待选择'].includes(request.status)) fail('INVALID_TRANSITION', '当前服务需求不可分配');
      const provider = state.organizations.find((o) => o.id === trusted.providerId && o.kind === 'provider' && o.status === '启用');
      if (!provider) return fail('PROVIDER_NOT_FOUND', '服务商不存在或未启用');
      request.providerId = provider.id; request.status = '已承接'; request.updatedAt = now;
      appendAudit(state, actor, 'service-request.assigned', 'ServiceRequest', request.id, undefined, { providerId: provider.id, status: request.status }, trusted.idempotencyKey, request);
      return state;
    }
    case 'customerSubmitInquiry': {
      const partyCompanyId = state.users.find((user) => user.id === actor.userId)?.partyCompanyId ?? fail('CUSTOMER_PROFILE_MISSING', '客户账号缺少关联的企业主体');
      if (hasAudit(state, trusted.idempotencyKey)) return state;
      if (state.inquiries.some((item) => item.id === trusted.inquiryId)) fail('IDEMPOTENCY_CONFLICT', '询价编号已存在');
      const summary = trusted.summary.trim();
      if (!summary) fail('INQUIRY_SUMMARY_REQUIRED', '询价需求不能为空');
      const projectId = actor.projectIds[0];
      if (!projectId) fail('ACTOR_SCOPE_INVALID', '客户缺少有效项目范围');
      const inquiry: Inquiry = { id: trusted.inquiryId, organizationId: actor.organizationId, projectId, createdAt: now, updatedAt: now, customerId: partyCompanyId, summary, images: trusted.images ?? [], status: '待确认' };
      state.inquiries.push(inquiry);
      state.sceneRuns.push({ id: `scene-${trusted.inquiryId}`, organizationId: actor.organizationId, projectId, createdAt: now, updatedAt: now, sceneType: 'inquiry', initiatedBy: actor.userId, targetObject: { type: 'Inquiry', id: inquiry.id }, status: '待确认', sourceEndpoint: 'H5' });
      state.matchResults.push({ id: `match-${trusted.inquiryId}`, organizationId: actor.organizationId, projectId, createdAt: now, updatedAt: now, inquiryId: inquiry.id, status: '处理中' });
      state.serviceRequests.push({ id: `service-request-${trusted.inquiryId}`, organizationId: actor.organizationId, projectId, createdAt: now, updatedAt: now, inquiryId: inquiry.id, status: '待受理' });
      addTask(state, actor, { title: '确认询价需求', kind: 'confirmation', objectType: 'Inquiry', objectId: inquiry.id, assigneeId: 'user-enterprise-owner', idempotencyKey: `inquiry-confirm-${inquiry.id}` }, inquiry);
      state.notifications.push({ id: `notification-${state.notifications.length + 1}`, organizationId: actor.organizationId, projectId, createdAt: now, updatedAt: now, recipientId: 'user-product-operator', title: '收到新的客户询价', status: '已发送', idempotencyKey: `inquiry-received-${inquiry.id}` });
      appendAudit(state, actor, 'inquiry.submitted', 'Inquiry', inquiry.id, undefined, { summary: inquiry.summary, status: inquiry.status, images: inquiry.images }, trusted.idempotencyKey, inquiry);
      return state;
    }
    default: return fail('ACTION_UNSUPPORTED', '不支持的领域动作');
  }
}
