import { createContext, useContext, useEffect, useReducer, useState, type PropsWithChildren } from 'react';
import { createInitialState } from './fixtures';
import { domainReducer } from './reducer';
import type { DomainAction, DomainState } from './types';
import { CANONICAL_STATUSES } from './types';

export const STORAGE_KEY = 'cross-border-scenario-platform:demo-state:v1';

export interface HydrationResult { state: DomainState; notice?: string; }
const stateCollections = ['organizations', 'users', 'roles', 'projectMemberships', 'partyCompanies', 'contacts', 'customerRelations', 'supplierRelations', 'providerRelations', 'products', 'skus', 'productAttributes', 'productAssets', 'productVersions', 'channelListings', 'leads', 'customerProfiles', 'touchTasks', 'followUps', 'opportunities', 'inquiries', 'matchResults', 'serviceRequests', 'logisticsQuotes', 'quotations', 'quotationVersions', 'quotationFeedbacks', 'complianceCases', 'risks', 'rectificationTasks', 'complianceMaterials', 'reviewRecords', 'orders', 'fulfillments', 'fulfillmentNodes', 'riskEvents', 'inventories', 'inboundRecords', 'reports', 'dataTasks', 'ruleConfigurations', 'sceneRuns', 'candidates', 'tasks', 'notifications', 'files', 'versionRecords', 'auditLogs', 'integrations'] as const;

const statusCollectionMap: Partial<Record<typeof stateCollections[number], keyof typeof CANONICAL_STATUSES>> = {
  organizations: 'Organization', users: 'User', roles: 'Role', projectMemberships: 'ProjectMembership', partyCompanies: 'PartyCompany', contacts: 'Contact', customerRelations: 'CustomerRelation', supplierRelations: 'SupplierRelation', providerRelations: 'ProviderRelation', products: 'Product', skus: 'SKU', productAttributes: 'ProductAttribute', productAssets: 'ProductAsset', productVersions: 'ProductVersion', channelListings: 'ChannelListing', leads: 'Lead', customerProfiles: 'CustomerProfile', touchTasks: 'TouchTask', followUps: 'FollowUp', opportunities: 'Opportunity', inquiries: 'Inquiry', matchResults: 'MatchResult', serviceRequests: 'ServiceRequest', logisticsQuotes: 'LogisticsQuote', quotations: 'Quotation', quotationVersions: 'QuotationVersion', complianceCases: 'ComplianceCase', risks: 'RiskItem', rectificationTasks: 'RectificationTask', complianceMaterials: 'ComplianceMaterial', reviewRecords: 'ReviewRecord', orders: 'Order', fulfillments: 'Fulfillment', fulfillmentNodes: 'FulfillmentNode', riskEvents: 'RiskEvent', inventories: 'Inventory', inboundRecords: 'InboundRecord', reports: 'Report', dataTasks: 'DataTask', ruleConfigurations: 'RuleConfiguration', sceneRuns: 'SceneRun', candidates: 'CandidateResult', tasks: 'Task', notifications: 'Notification', files: 'FileAsset', auditLogs: 'AuditLog', integrations: 'IntegrationRecord',
};
const collectionByObjectType: Record<string, string> = { Organization: 'organizations', User: 'users', Role: 'roles', ProjectMembership: 'projectMemberships', PartyCompany: 'partyCompanies', Contact: 'contacts', CustomerRelation: 'customerRelations', SupplierRelation: 'supplierRelations', ProviderRelation: 'providerRelations', Product: 'products', SKU: 'skus', ProductAttribute: 'productAttributes', ProductAsset: 'productAssets', ProductVersion: 'productVersions', ChannelListing: 'channelListings', Lead: 'leads', CustomerProfile: 'customerProfiles', TouchTask: 'touchTasks', FollowUp: 'followUps', Opportunity: 'opportunities', Inquiry: 'inquiries', MatchResult: 'matchResults', ServiceRequest: 'serviceRequests', LogisticsQuote: 'logisticsQuotes', Quotation: 'quotations', QuotationVersion: 'quotationVersions', ComplianceCase: 'complianceCases', RiskItem: 'risks', RectificationTask: 'rectificationTasks', ComplianceMaterial: 'complianceMaterials', ReviewRecord: 'reviewRecords', Order: 'orders', Fulfillment: 'fulfillments', FulfillmentNode: 'fulfillmentNodes', RiskEvent: 'riskEvents', Inventory: 'inventories', InboundRecord: 'inboundRecords', Report: 'reports', DataTask: 'dataTasks', RuleConfiguration: 'ruleConfigurations', SceneRun: 'sceneRuns', CandidateResult: 'candidates', Task: 'tasks', Notification: 'notifications', FileAsset: 'files', VersionRecord: 'versionRecords', AuditLog: 'auditLogs', IntegrationRecord: 'integrations' };
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function hasString(record: Record<string, unknown>, key: string): boolean { return typeof record[key] === 'string' && Boolean(record[key]); }
function hasNumber(record: Record<string, unknown>, key: string): boolean { return typeof record[key] === 'number' && Number.isFinite(record[key]); }
function sameScope(value: unknown, target: Record<string, unknown>): boolean { return isRecord(value) && value.organizationId === target.organizationId && value.projectId === target.projectId; }
function sameProject(value: unknown, target: Record<string, unknown>): boolean { return isRecord(value) && value.projectId === target.projectId; }
export function validatePersistedState(value: unknown): value is DomainState {
  if (!isRecord(value) || !stateCollections.every((key) => Array.isArray(value[key]))) return false;
  const ids = new Set<string>();
  for (const key of stateCollections) for (const record of value[key] as unknown[]) {
    if (!isRecord(record) || typeof record.id !== 'string' || !record.id || ids.has(record.id) || typeof record.organizationId !== 'string' || typeof record.projectId !== 'string' || typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string') return false;
    ids.add(record.id);
    const statusKey = statusCollectionMap[key];
    if (statusKey && !(CANONICAL_STATUSES[statusKey] as readonly unknown[]).includes(record.status)) return false;
    if (key === 'organizations' && (!hasString(record, 'name') || !['platform', 'enterprise', 'provider'].includes(String(record.kind)))) return false;
    if (key === 'users' && (!hasString(record, 'name') || !hasString(record, 'roleId'))) return false;
    if (key === 'contacts' && (!hasString(record, 'partyCompanyId') || !hasString(record, 'name') || !hasString(record, 'email'))) return false;
    if (key === 'productAttributes' && (!hasString(record, 'productId') || !hasString(record, 'name') || !hasString(record, 'value'))) return false;
    if (key === 'roles' && (!hasString(record, 'name') || !['enterprise_owner', 'product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'service_provider', 'platform_operator'].includes(String(record.code)))) return false;
    if (key === 'projectMemberships' && (!hasString(record, 'userId') || !hasString(record, 'roleId'))) return false;
    if (key === 'products' && (!hasString(record, 'name') || !hasString(record, 'description') || !hasString(record, 'ownerId') || !hasNumber(record, 'currentVersion'))) return false;
    if (key === 'leads' && (!hasString(record, 'name') || !hasString(record, 'companyId') || !hasNumber(record, 'version'))) return false;
    if (key === 'quotations' && (!hasString(record, 'inquiryId') || !hasNumber(record, 'currentVersion') || !hasNumber(record, 'amount') || !Array.isArray(record.combination) || record.combination.some((part) => typeof part !== 'string' || !part))) return false;
    if (key === 'quotationVersions' && (!hasString(record, 'quotationId') || !hasNumber(record, 'version') || !hasNumber(record, 'amount') || !Array.isArray(record.combination) || record.combination.some((part) => typeof part !== 'string' || !part))) return false;
    if (key === 'quotationFeedbacks' && (!hasString(record, 'quotationId') || !['viewed', 'accepted', 'rejected', 'negotiating'].includes(String(record.feedback)))) return false;
    if (key === 'complianceCases' && (!hasString(record, 'subjectId') || !['Product', 'Order', 'Organization'].includes(String(record.subjectType)) || !['境内', '境外'].includes(String(record.scope)))) return false;
    if (key === 'risks' && (!hasString(record, 'caseId') || !hasString(record, 'title'))) return false;
    if (key === 'rectificationTasks' && (!hasString(record, 'riskId') || !hasString(record, 'ownerId'))) return false;
    if (key === 'complianceMaterials' && (!hasString(record, 'caseId') || !hasString(record, 'fileAssetId'))) return false;
    if (key === 'reviewRecords' && (!hasString(record, 'caseId') || !hasString(record, 'reviewerId'))) return false;
    if (key === 'orders' && !hasString(record, 'customerId')) return false;
    if (key === 'fulfillments' && !hasString(record, 'orderId')) return false;
    if (key === 'fulfillmentNodes' && (!hasString(record, 'fulfillmentId') || !hasString(record, 'name'))) return false;
    if (key === 'riskEvents' && (!hasString(record, 'orderId') || !hasString(record, 'nodeId'))) return false;
    if (key === 'inventories' && (!hasString(record, 'skuId') || !hasNumber(record, 'quantity'))) return false;
    if (key === 'inboundRecords' && (!hasString(record, 'orderId') || !hasNumber(record, 'quantity'))) return false;
    if (key === 'sceneRuns' && (!hasString(record, 'sceneType') || !hasString(record, 'initiatedBy') || !isRecord(record.targetObject) || !hasString(record.targetObject, 'type') || !hasString(record.targetObject, 'id'))) return false;
    if (key === 'candidates' && (!hasString(record, 'sceneRunId') || !isRecord(record.targetObject) || !hasNumber(record, 'sourceVersion') || !hasNumber(record, 'candidateVersion') || !isRecord(record.payload) || !isRecord(record.fieldMapping) || !hasString(record, 'idempotencyKey'))) return false;
    if (key === 'notifications' && (!hasString(record, 'recipientId') || !hasString(record, 'title') || !hasString(record, 'idempotencyKey'))) return false;
    if (key === 'tasks' && (!hasString(record, 'title') || !hasString(record, 'objectType') || !hasString(record, 'objectId') || !hasString(record, 'assigneeId'))) return false;
  }
  const organizations = value.organizations as Record<string, unknown>[]; const users = value.users as Record<string, unknown>[]; const roles = value.roles as Record<string, unknown>[]; const memberships = value.projectMemberships as Record<string, unknown>[];
  const knownProjects = new Set(organizations.map((organization) => String(organization.projectId)));
  const organizationProjects = new Map<string, Set<string>>();
  for (const organization of organizations) organizationProjects.set(String(organization.id), organization.kind === 'platform' ? new Set(knownProjects) : new Set([String(organization.projectId)]));
  if (memberships.some((membership) => !knownProjects.has(String(membership.projectId)) || !organizationProjects.get(String(membership.organizationId))?.has(String(membership.projectId)))) return false;
  if (stateCollections.some((key) => (value[key] as Record<string, unknown>[]).some((record) => !organizations.some((organization) => organization.id === record.organizationId) || !organizationProjects.get(String(record.organizationId))?.has(String(record.projectId))))) return false;
  if (users.some((user) => !organizations.some((org) => org.id === user.organizationId) || !roles.some((role) => role.id === user.roleId && role.organizationId === user.organizationId))) return false;
  if (memberships.some((membership) => !users.some((user) => user.id === membership.userId && user.organizationId === membership.organizationId) || !roles.some((role) => role.id === membership.roleId && role.organizationId === membership.organizationId))) return false;
  const has = (collection: string, id: unknown) => typeof id === 'string' && (value[collection] as Record<string, unknown>[] | undefined)?.some((record) => record.id === id) === true;
  const get = (collection: string, id: unknown) => typeof id === 'string' ? (value[collection] as Record<string, unknown>[] | undefined)?.find((record) => record.id === id) : undefined;
  const scoped = (collection: string, id: unknown, owner: Record<string, unknown>, crossOrg = false) => { const target = get(collection, id); return Boolean(target && (crossOrg ? sameProject(target, owner) : sameScope(target, owner))); };
  for (const record of value.productAssets as Record<string, unknown>[]) if (!scoped('products', record.productId, record) || !scoped('files', record.fileAssetId, record)) return false;
  for (const record of value.productVersions as Record<string, unknown>[]) if (!scoped('products', record.productId, record)) return false;
  for (const record of value.channelListings as Record<string, unknown>[]) if (!scoped('products', record.productId, record)) return false;
  for (const record of value.risks as Record<string, unknown>[]) if (!scoped('complianceCases', record.caseId, record)) return false;
  for (const record of value.rectificationTasks as Record<string, unknown>[]) if (!scoped('risks', record.riskId, record)) return false;
  for (const record of value.complianceMaterials as Record<string, unknown>[]) if (!scoped('complianceCases', record.caseId, record) || !scoped('files', record.fileAssetId, record)) return false;
  for (const record of value.reviewRecords as Record<string, unknown>[]) if (!scoped('complianceCases', record.caseId, record)) return false;
  for (const record of value.fulfillments as Record<string, unknown>[]) if (!scoped('orders', record.orderId, record)) return false;
  for (const record of value.fulfillmentNodes as Record<string, unknown>[]) if (!scoped('fulfillments', record.fulfillmentId, record)) return false;
  for (const record of value.riskEvents as Record<string, unknown>[]) if (!scoped('orders', record.orderId, record) || !scoped('fulfillmentNodes', record.nodeId, record)) return false;
  for (const record of value.inboundRecords as Record<string, unknown>[]) if (!scoped('orders', record.orderId, record)) return false;
  for (const record of value.quotationVersions as Record<string, unknown>[]) if (!scoped('quotations', record.quotationId, record)) return false;
  for (const record of value.quotationFeedbacks as Record<string, unknown>[]) if (!scoped('quotations', record.quotationId, record)) return false;
  for (const record of value.inventories as Record<string, unknown>[]) if (!scoped('skus', record.skuId, record)) return false;
  for (const record of value.skus as Record<string, unknown>[]) if (!scoped('products', record.productId, record)) return false;
  for (const record of value.productAttributes as Record<string, unknown>[]) if (!scoped('products', record.productId, record)) return false;
  for (const record of value.contacts as Record<string, unknown>[]) if (!scoped('partyCompanies', record.partyCompanyId, record)) return false;
  for (const record of value.leads as Record<string, unknown>[]) if (!scoped('partyCompanies', record.companyId, record)) return false;
  for (const record of value.customerProfiles as Record<string, unknown>[]) if (!scoped('partyCompanies', record.companyId, record)) return false;
  for (const record of value.touchTasks as Record<string, unknown>[]) if (!scoped('leads', record.leadId, record) || !has('users', record.ownerId)) return false;
  for (const record of value.followUps as Record<string, unknown>[]) if (!scoped('leads', record.leadId, record) || !has('users', record.ownerId)) return false;
  for (const record of value.opportunities as Record<string, unknown>[]) if (record.leadId && !scoped('leads', record.leadId, record)) return false;
  for (const record of value.matchResults as Record<string, unknown>[]) if (!scoped('inquiries', record.inquiryId, record)) return false;
  for (const record of value.serviceRequests as Record<string, unknown>[]) if (!scoped('inquiries', record.inquiryId, record)) return false;
  for (const record of value.logisticsQuotes as Record<string, unknown>[]) if (!scoped('inquiries', record.inquiryId, record)) return false;
  for (const record of value.inquiries as Record<string, unknown>[]) if (!scoped('partyCompanies', record.customerId, record)) return false;
  for (const record of value.orders as Record<string, unknown>[]) if (!scoped('partyCompanies', record.customerId, record)) return false;
  for (const record of value.quotations as Record<string, unknown>[]) if (!scoped('inquiries', record.inquiryId, record)) return false;
  for (const record of value.sceneRuns as Record<string, unknown>[]) { const target = record.targetObject as Record<string, unknown>; if (!has(collectionByObjectType[String(target.type)] ?? '', target.id) || !scoped(collectionByObjectType[String(target.type)] ?? '', target.id, record)) return false; }
  for (const record of value.sceneRuns as Record<string, unknown>[]) if (!users.some((user) => user.id === record.initiatedBy && user.organizationId === record.organizationId) || !memberships.some((membership) => membership.userId === record.initiatedBy && membership.projectId === record.projectId && membership.status === '启用')) return false;
  for (const record of value.candidates as Record<string, unknown>[]) { const target = record.targetObject as Record<string, unknown>; if (!has(collectionByObjectType[String(target.type)] ?? '', target.id) || !scoped(collectionByObjectType[String(target.type)] ?? '', target.id, record)) return false; }
  for (const record of value.versionRecords as Record<string, unknown>[]) if (!scoped(collectionByObjectType[String(record.objectType)] ?? '', record.objectId, record)) return false;
  for (const record of value.candidates as Record<string, unknown>[]) if (!has('sceneRuns', record.sceneRunId)) return false;
  for (const record of value.candidates as Record<string, unknown>[]) {
    const scene = get('sceneRuns', record.sceneRunId); const target = record.targetObject as Record<string, unknown>;
    if (!scene || !isRecord(scene.targetObject) || scene.targetObject.type !== target.type || scene.targetObject.id !== target.id) return false;
  }
  for (const record of value.sceneRuns as Record<string, unknown>[]) if (!isRecord(record.targetObject) || !has(collectionByObjectType[String(record.targetObject.type)] ?? '', record.targetObject.id)) return false;
  for (const record of value.tasks as Record<string, unknown>[]) {
    if (!has(collectionByObjectType[String(record.objectType)] ?? '', record.objectId) || !scoped(collectionByObjectType[String(record.objectType)] ?? '', record.objectId, record)) return false;
    const assignee = get('users', record.assigneeId);
    const assigneeRole = assignee && get('roles', assignee.roleId);
    if (!assignee || assignee.projectId !== record.projectId || (assignee.organizationId !== record.organizationId && assigneeRole?.code !== 'service_provider')) return false;
  }
  for (const record of value.notifications as Record<string, unknown>[]) if (!users.some((user) => user.id === record.recipientId && user.projectId === record.projectId)) return false;
  for (const record of value.customerRelations as Record<string, unknown>[]) if (!scoped('partyCompanies', record.sourceCompanyId, record, true) || !scoped('partyCompanies', record.targetCompanyId, record, true)) return false;
  for (const record of value.supplierRelations as Record<string, unknown>[]) if (!scoped('partyCompanies', record.sourceCompanyId, record, true) || !scoped('partyCompanies', record.targetCompanyId, record, true)) return false;
  for (const record of value.providerRelations as Record<string, unknown>[]) if (!scoped('partyCompanies', record.sourceCompanyId, record, true) || !scoped('partyCompanies', record.targetCompanyId, record, true)) return false;
  for (const record of value.complianceCases as Record<string, unknown>[]) if (!scoped(collectionByObjectType[String(record.subjectType)] ?? '', record.subjectId, record)) return false;
  return true;
}

export function hydratePersistedState(): HydrationResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: createInitialState() };
    const parsed: unknown = JSON.parse(raw);
    const valid = validatePersistedState(parsed);
    if (!valid) return { state: createInitialState(), notice: '本地演示数据无效，已恢复为初始数据。' };
    return { state: parsed as DomainState };
  } catch {
    return { state: createInitialState(), notice: '本地演示数据无效，已恢复为初始数据。' };
  }
}

const StoreContext = createContext<{ state: DomainState; dispatch: React.Dispatch<DomainAction>; reset: () => void; hydrationNotice?: string } | null>(null);

export function DomainProvider({ children }: PropsWithChildren) {
  const [hydration] = useState(hydratePersistedState);
  const [state, dispatch] = useReducer(domainReducer, hydration.state);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  const reset = () => dispatch({ type: 'resetDemo' });
  return <StoreContext.Provider value={{ state, dispatch, reset, hydrationNotice: hydration.notice }}>{children}</StoreContext.Provider>;
}

export function useDomainStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useDomainStore must be used inside DomainProvider');
  return value;
}
