import { describe, expect, it } from 'vitest';
import { demoState } from '../domain/fixtures';
import { domainReducer, DomainError } from '../domain/reducer';
import type { Actor, DomainAction, DomainState } from '../domain/types';

const enterpriseOwner: Actor = { userId: 'user-enterprise-owner', organizationId: 'org-enterprise-wenzhou', projectIds: ['project-wenzhou'], role: 'enterprise_owner' };
const productOperator: Actor = { userId: 'user-product-operator', organizationId: 'org-enterprise-wenzhou', projectIds: ['project-wenzhou'], role: 'product_operator' };
const provider: Actor = { userId: 'user-provider', organizationId: 'org-service-provider', projectIds: ['project-wenzhou'], role: 'service_provider' };

function apply(action: DomainAction, state = demoState) {
  return domainReducer(state, action);
}

const compliantState: DomainState = { ...demoState, complianceCases: [{ ...demoState.complianceCases[0], status: '已通过' as const }], risks: [{ ...demoState.risks[0], status: '已解除' as const }], complianceMaterials: [{ ...demoState.complianceMaterials[0], status: '已确认' as const }], reviewRecords: [{ ...demoState.reviewRecords[0], status: '通过' as const }] };

describe('authoritative local reducer', () => {
  it('creates a draft, completes processing, and keeps candidate data separate', () => {
    const created = apply({ type: 'createProductDraft', actor: enterpriseOwner, productId: 'product-new', name: '新商品' });
    expect(created.products.find((item) => item.id === 'product-new')?.status).toBe('草稿');

    const running = apply({ type: 'startScene', actor: productOperator, sceneRunId: 'scene-new', sceneType: 'product-content', targetObject: { type: 'Product', id: 'product-new' } }, created);
    const processed = apply({ type: 'processingComplete', actor: productOperator, sceneRunId: 'scene-new', candidateId: 'candidate-new', payload: { description: '候选描述' }, sourceVersion: 0, idempotencyKey: 'run-new-1' }, running);
    expect(processed.products[1]?.description).not.toBe('候选描述');
    expect(processed.candidates.find((item) => item.id === 'candidate-new')?.status).toBe('待确认');
    expect(processed.sceneRuns.find((item) => item.id === 'scene-new')?.status).toBe('待确认');
  });

  it('confirms a matching candidate atomically into a new formal version and task', () => {
    const result = apply({ type: 'confirmCandidate', actor: enterpriseOwner, candidateId: 'candidate-product-description', idempotencyKey: 'confirm-product-1' }, compliantState);
    expect(result.candidates.find((item) => item.id === 'candidate-product-description')?.status).toBe('已确认');
    expect(result.products[0].description).toBe('Industrial storage rack for global warehouses.');
    expect(result.products[0].currentVersion).toBe(2);
    expect(result.productVersions.some((item) => item.version === 2 && item.status === '已生效')).toBe(true);
    expect(result.tasks.some((item) => item.idempotencyKey === 'publish-product-product-demo')).toBe(true);
    expect(result.auditLogs.some((item) => item.action === 'candidate.confirmed')).toBe(true);
  });

  it('rejects stale writeback without changing formal data', () => {
    expect(() => apply({ type: 'confirmCandidate', actor: enterpriseOwner, candidateId: 'candidate-stale-product', idempotencyKey: 'stale-1' })).toThrowError('SOURCE_VERSION_CONFLICT');
    expect(demoState.products[0].description).toBe('Steel storage rack');
  });

  it('prevents providers from confirming enterprise formal data', () => {
    expect(() => apply({ type: 'confirmCandidate', actor: provider, candidateId: 'candidate-product-description', idempotencyKey: 'provider-confirm-1' })).toThrowError('SERVICE_PROVIDER_CANNOT_CONFIRM_FORMAL_DATA');
  });

  it('enforces task ownership and organization scope', () => {
    expect(() => apply({ type: 'completeTask', actor: productOperator, taskId: 'task-owner-only' })).toThrowError('TASK_OWNER_REQUIRED');
    expect(() => apply({ type: 'completeTask', actor: { ...enterpriseOwner, organizationId: 'org-enterprise-nanjing', projectIds: ['project-nanjing'] }, taskId: 'task-product-confirm' })).toThrowError('ORGANIZATION_SCOPE_DENIED');
  });

  it('supports stable failure recovery and idempotent retry', () => {
    const failed = apply({ type: 'markSceneFailure', actor: productOperator, sceneRunId: 'scene-product-demo', failure: 'external', message: '接口暂不可用' });
    expect(failed.sceneRuns.find((item) => item.id === 'scene-product-demo')?.status).toBe('失败');
    const retried = apply({ type: 'retryScene', actor: productOperator, sceneRunId: 'scene-product-demo', idempotencyKey: 'retry-scene-failed' }, failed);
    expect(retried.sceneRuns.find((item) => item.id === 'scene-product-demo')?.status).toBe('处理中');
    const twice = apply({ type: 'retryScene', actor: productOperator, sceneRunId: 'scene-product-demo', idempotencyKey: 'retry-scene-failed' }, retried);
    expect(twice.auditLogs.filter((item) => item.idempotencyKey === 'retry-scene-failed')).toHaveLength(1);
  });

  it('keeps file, timeout, and rule-indeterminate failures recoverable', () => {
    let state = apply({ type: 'markSceneFailure', actor: productOperator, sceneRunId: 'scene-product-demo', failure: 'file', message: '文件处理失败' });
    expect(state.sceneRuns.find((item) => item.id === 'scene-product-demo')?.status).toBe('失败');
    expect(state.tasks.some((item) => item.kind === 'exception' && item.title === '重新提交文件')).toBe(true);
    state = apply({ type: 'markSceneFailure', actor: productOperator, sceneRunId: 'scene-failed', failure: 'timeout', message: '处理超时' }, { ...state, sceneRuns: state.sceneRuns.map((scene) => scene.id === 'scene-failed' ? { ...scene, status: '处理中' } : scene) });
    expect(state.sceneRuns.find((item) => item.id === 'scene-failed')?.status).toBe('超时');
    expect(state.tasks.filter((item) => item.kind === 'exception')).toHaveLength(2);
    state = apply({ type: 'markSceneFailure', actor: productOperator, sceneRunId: 'scene-rule-indeterminate', failure: 'rule_indeterminate', message: '规则无法判断' }, state);
    expect(state.sceneRuns.find((item) => item.id === 'scene-rule-indeterminate')?.status).toBe('待确认');
    expect(state.tasks.filter((item) => item.kind === 'rule_review')).toHaveLength(1);
  });

  it('returns deterministic fixtures through reset without sharing mutable references', () => {
    const changed = apply({ type: 'confirmCandidate', actor: enterpriseOwner, candidateId: 'candidate-product-description', idempotencyKey: 'reset-check' }, compliantState);
    const reset = apply({ type: 'resetDemo' }, changed);
    expect(reset.products[0].description).toBe('Steel storage rack');
    reset.products[0].name = '不应影响下一次重置';
    expect(apply({ type: 'resetDemo' }).products[0].name).toBe('仓储货架');
  });

  it('moves lead, compliance, quotation, and order records through key transitions', () => {
    let state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'confirm' });
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'processing_complete' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'store' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'assign' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'touch' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'follow_up' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'convert' }, state);
    expect(state.leads[0].status).toBe('跟进中');
    expect(state.opportunities).toHaveLength(1);

    state = apply({ type: 'riskResolve', actor: enterpriseOwner, riskId: 'risk-demo' }, { ...state, risks: [{ ...state.risks[0], status: '待复核' }], complianceCases: [{ ...state.complianceCases[0], status: '待复核' }], rectificationTasks: [{ ...state.rectificationTasks[0], status: '待复核' }], complianceMaterials: [{ ...state.complianceMaterials[0], status: '已确认' }], reviewRecords: [{ ...state.reviewRecords[0], status: '待复核' }] });
    expect(state.risks[0].status).toBe('已解除');
    state = apply({ type: 'quotationFeedback', actor: enterpriseOwner, quotationId: 'quotation-demo', feedback: 'viewed', idempotencyKey: 'old-quote-viewed' }, state);
    expect(state.quotations[0].status).toBe('客户已查看');
    state = apply({ type: 'fulfillmentNodeEvent', actor: enterpriseOwner, nodeId: 'fulfillment-node-demo', orderId: 'order-demo', event: 'complete', inboundRecordId: 'inbound-demo', inventoryId: 'inventory-demo' }, state);
    expect(state.fulfillmentNodes[0].status).toBe('已完成');
  });

  it('does not mutate audit entries and preserves recovery metadata', () => {
    const original = demoState.auditLogs.map((item) => ({ ...item }));
    const next = apply({ type: 'markSceneFailure', actor: productOperator, sceneRunId: 'scene-rule-indeterminate', failure: 'rule_indeterminate', message: '规则无法判断' });
    expect(next.sceneRuns.find((item) => item.id === 'scene-rule-indeterminate')?.status).toBe('待确认');
    expect(next.tasks.some((item) => item.kind === 'rule_review')).toBe(true);
    expect(demoState.auditLogs).toEqual(original);
  });

  it('writes a non-product candidate back to the formal object and downstream records', () => {
    const state = apply({ type: 'writebackObject', actor: enterpriseOwner, candidateId: 'candidate-lead-profile', idempotencyKey: 'writeback-lead-1' });
    expect(state.leads[0].name).toBe('Global Warehouse Buyer / confirmed');
    expect(state.versionRecords.some((item) => item.objectType === 'Lead' && item.objectId === 'lead-demo' && item.version === 2 && item.status === '正式')).toBe(true);
    expect(state.sceneRuns.find((item) => item.id === 'scene-lead-profile')?.status).toBe('已确认');
    expect(state.tasks.some((item) => item.idempotencyKey === 'lead-follow-up-lead-demo')).toBe(true);
    expect(state.auditLogs.some((item) => item.action === 'candidate.written-back' && item.objectType === 'Lead')).toBe(true);
  });

  it('follows the canonical lead path with profile, touch, follow-up, and opportunity effects', () => {
    let state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'confirm' });
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'processing_complete' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'store' }, state);
    expect(state.leads[0].status).toBe('已入库');
    expect(state.customerProfiles[0].status).toBe('有效');
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'assign' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'touch' }, state);
    expect(state.leads[0].status).toBe('已触达');
    expect(state.touchTasks[0].status).toBe('已发送');
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'follow_up' }, state);
    expect(state.leads[0].status).toBe('跟进中');
    expect(state.followUps[0].status).toBe('跟进中');
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'convert' }, state);
    expect(state.leads[0].status).toBe('跟进中');
    expect(state.opportunities[0].status).toBe('跟进中');
  });

  it('rejects lifecycle events that skip the authoritative lead state', () => {
    expect(() => apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'touch' })).toThrowError('INVALID_TRANSITION');
  });

  it('resolves compliance risk only from review-ready state and updates the case chain', () => {
    const readyState: DomainState = { ...demoState, risks: [{ ...demoState.risks[0], status: '待复核' as const }], complianceCases: [{ ...demoState.complianceCases[0], status: '待复核' as const }], rectificationTasks: [{ ...demoState.rectificationTasks[0], status: '待复核' as const }], reviewRecords: [{ ...demoState.reviewRecords[0], status: '待复核' as const }] };
    const state = apply({ type: 'riskResolve', actor: enterpriseOwner, riskId: 'risk-demo' }, { ...readyState, complianceMaterials: [{ ...readyState.complianceMaterials[0], status: '已确认' as const }] });
    expect(state.risks[0].status).toBe('已解除');
    expect(state.complianceCases[0].status).toBe('已通过');
    expect(state.rectificationTasks[0].status).toBe('已通过');
    expect(state.reviewRecords[0].status).toBe('通过');
    expect(state.tasks.find((item) => item.id === 'task-provider-risk')?.status).toBe('已完成');
    expect(() => apply({ type: 'riskResolve', actor: enterpriseOwner, riskId: 'risk-demo' }, { ...demoState, risks: [{ ...demoState.risks[0], status: '已确认' }] })).toThrowError('INVALID_TRANSITION');
  });

  it('creates quotation versions and the correct accepted or negotiating side effects', () => {
    let state = apply({ type: 'quotationFeedback', actor: enterpriseOwner, quotationId: 'quotation-demo', feedback: 'viewed', idempotencyKey: 'quote-viewed-1' });
    state = apply({ type: 'quotationFeedback', actor: enterpriseOwner, quotationId: 'quotation-demo', feedback: 'negotiating', idempotencyKey: 'quote-negotiating-1' }, state);
    expect(state.quotations[0].status).toBe('议价中');
    expect(state.tasks.some((item) => item.idempotencyKey === 'quotation-follow-up-quotation-demo')).toBe(true);
    state = apply({ type: 'quotationFeedback', actor: enterpriseOwner, quotationId: 'quotation-demo', feedback: 'accepted', idempotencyKey: 'quote-accepted-1' }, state);
    expect(state.quotations[0].status).toBe('已接受');
    expect(state.quotationVersions).toHaveLength(1);
    expect(state.opportunities.some((item) => item.quotationId === 'quotation-demo')).toBe(true);
    expect(() => apply({ type: 'quotationFeedback', actor: enterpriseOwner, quotationId: 'quotation-demo', feedback: 'viewed', idempotencyKey: 'illegal-quote-view' }, state)).toThrowError('INVALID_TRANSITION');
  });

  it('updates node, risk, inventory, inbound, fulfillment, and order state together', () => {
    let state = apply({ type: 'fulfillmentNodeEvent', actor: enterpriseOwner, nodeId: 'fulfillment-node-demo', orderId: 'order-demo', event: 'risk', riskEventId: 'risk-event-demo' });
    expect(state.riskEvents[0].status).toBe('新建');
    expect(state.orders[0].status).toBe('履约异常');
    state = apply({ type: 'fulfillmentNodeEvent', actor: enterpriseOwner, nodeId: 'fulfillment-node-demo', orderId: 'order-demo', event: 'resolve', riskEventId: 'risk-event-demo' }, state);
    state = apply({ type: 'fulfillmentNodeEvent', actor: enterpriseOwner, nodeId: 'fulfillment-node-demo', orderId: 'order-demo', event: 'complete', riskEventId: 'risk-event-demo', inboundRecordId: 'inbound-demo', inventoryId: 'inventory-demo' }, state);
    expect(state.riskEvents[0].status).toBe('已关闭');
    expect(state.inboundRecords[0].status).toBe('已入库');
    expect(state.inventories[0].quantity).toBe(100);
    expect(state.fulfillments[0].status).toBe('已完成');
    expect(state.orders[0].status).toBe('已完成');
    expect(() => apply({ type: 'fulfillmentNodeEvent', actor: enterpriseOwner, nodeId: 'fulfillment-node-demo', orderId: 'order-demo', event: 'pause' }, { ...demoState, fulfillmentNodes: [{ ...demoState.fulfillmentNodes[0], status: '已完成' }] })).toThrowError('INVALID_TRANSITION');
  });

  it('derives permissions from state instead of trusting role and scope supplied by caller', () => {
    const forged = { ...enterpriseOwner, role: 'platform_operator' as const, organizationId: 'org-platform', projectIds: ['project-nanjing'] };
    expect(() => apply({ type: 'confirmCandidate', actor: forged, candidateId: 'candidate-product-description', idempotencyKey: 'forged-actor' })).toThrowError('ORGANIZATION_SCOPE_DENIED');
    expect(() => apply({ type: 'completeTask', actor: { ...enterpriseOwner, userId: 'user-disabled' }, taskId: 'task-product-confirm' })).toThrowError('ACTOR_NOT_AUTHORIZED');
  });

  it('deduplicates repeated quotation and fulfillment events', () => {
    const first = apply({ type: 'quotationFeedback', actor: enterpriseOwner, quotationId: 'quotation-demo', feedback: 'viewed', idempotencyKey: 'same-quote-event' });
    const second = apply({ type: 'quotationFeedback', actor: enterpriseOwner, quotationId: 'quotation-demo', feedback: 'viewed', idempotencyKey: 'same-quote-event' }, first);
    expect(second.auditLogs.filter((item) => item.idempotencyKey === 'same-quote-event')).toHaveLength(1);
  });

  it('uses the authoritative lead processing state and rejects the removed status', () => {
    let state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'confirm' });
    expect(state.leads[0].status).toBe('处理中');
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'processing_complete' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'store' }, state);
    expect(state.leads[0].status).toBe('已入库');
    expect(() => apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'touch' }, state)).toThrowError('INVALID_TRANSITION');
  });

  it('blocks product publication until every linked compliance risk is resolved', () => {
    const blocked = apply({ type: 'confirmCandidate', actor: enterpriseOwner, candidateId: 'candidate-product-description', idempotencyKey: 'blocked-product-confirm' });
    expect(blocked.products[0].status).toBe('需整改');
    expect(blocked.tasks.some((item) => item.kind === 'publish')).toBe(false);
    const ready = { ...demoState, complianceCases: [{ ...demoState.complianceCases[0], status: '已通过' as const }], risks: [{ ...demoState.risks[0], status: '已解除' as const }], complianceMaterials: [{ ...demoState.complianceMaterials[0], status: '已确认' as const }], reviewRecords: [{ ...demoState.reviewRecords[0], status: '通过' as const }] };
    const confirmed = apply({ type: 'confirmCandidate', actor: enterpriseOwner, candidateId: 'candidate-product-description', idempotencyKey: 'ready-product-confirm' }, ready);
    expect(confirmed.products[0].status).toBe('可经营');
    expect(confirmed.tasks.some((item) => item.kind === 'publish')).toBe(true);
  });

  it('requires all case materials and risks before compliance approval', () => {
    const incomplete = { ...demoState, risks: [{ ...demoState.risks[0], status: '待复核' as const }], complianceCases: [{ ...demoState.complianceCases[0], status: '待复核' as const }], rectificationTasks: [{ ...demoState.rectificationTasks[0], status: '待复核' as const }], reviewRecords: [{ ...demoState.reviewRecords[0], status: '待复核' as const }] };
    expect(() => apply({ type: 'riskResolve', actor: enterpriseOwner, riskId: 'risk-demo' }, incomplete)).toThrowError('PREREQUISITE_MISSING');
  });

  it('supports typed canonical object events without arbitrary status assignment', () => {
    let state = apply({ type: 'inquiryEvent', actor: enterpriseOwner, inquiryId: 'inquiry-demo', event: 'process' }, { ...demoState, inquiries: [{ ...demoState.inquiries[0], status: '草稿' as const }] });
    expect(state.inquiries[0].status).toBe('处理中');
    state = apply({ type: 'inquiryEvent', actor: enterpriseOwner, inquiryId: 'inquiry-demo', event: 'close' }, state);
    expect(state.inquiries[0].status).toBe('已关闭');
    expect(() => apply({ type: 'inquiryEvent', actor: enterpriseOwner, inquiryId: 'inquiry-demo', event: 'confirm' }, state)).toThrowError('INVALID_TRANSITION');
  });

  it('validates task assignee existence, enabled status, scope, and membership', () => {
    expect(() => apply({ type: 'assignTask', actor: enterpriseOwner, taskId: 'task-product-confirm', assigneeId: 'missing-user' })).toThrowError('ASSIGNEE_NOT_AUTHORIZED');
    expect(() => apply({ type: 'assignTask', actor: enterpriseOwner, taskId: 'task-product-confirm', assigneeId: 'user-provider' })).toThrowError('ASSIGNEE_SCOPE_DENIED');
  });

  it('allows only explicit target field mappings and records failed writeback for retry', () => {
    const forbidden = { ...demoState, candidates: [{ ...demoState.candidates[2], fieldMapping: { status: 'status' }, payload: { status: '已入库' } }] };
    const failed = apply({ type: 'writebackObject', actor: enterpriseOwner, candidateId: 'candidate-lead-profile', idempotencyKey: 'writeback-forbidden' }, forbidden);
    expect(failed.candidates.find((item) => item.id === 'candidate-lead-profile')?.status).toBe('写回失败');
    expect(failed.tasks.some((item) => item.kind === 'exception' && item.idempotencyKey === 'writeback-retry-candidate-lead-profile')).toBe(true);
    expect(failed.leads[0].status).toBe('待筛选');
  });

  it('rejects source payload metadata even when the target has the property', () => {
    const candidate = { ...demoState.candidates[2], fieldMapping: { organizationId: 'organizationId' }, payload: { organizationId: 'org-enterprise-nanjing' } };
    const state = { ...demoState, candidates: [candidate, ...demoState.candidates.slice(0, 2)] };
    const failed = apply({ type: 'writebackObject', actor: enterpriseOwner, candidateId: candidate.id, idempotencyKey: 'writeback-scope-forbidden' }, state);
    expect(failed.candidates[0].status).toBe('写回失败');
    expect(failed.leads[0].organizationId).toBe('org-enterprise-wenzhou');
  });

  it('requires the complete authoritative lead event sequence', () => {
    let state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'confirm' });
    expect(state.leads[0].status).toBe('处理中');
    expect(() => apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'store' }, state)).toThrowError('INVALID_TRANSITION');
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'processing_complete' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'store' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'assign' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'touch' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'follow_up' }, state);
    state = apply({ type: 'leadEvent', actor: productOperator, leadId: 'lead-demo', event: 'convert' }, state);
    expect(state.leads[0].status).toBe('跟进中');
    expect(state.customerProfiles[0].status).toBe('有效');
    expect(state.touchTasks[0].status).toBe('已发送');
    expect(state.followUps[0].status).toBe('已完成');
    expect(state.opportunities[0].leadId).toBe('lead-demo');
  });

  it('keeps quotation feedback separate from version content and preserves accepted terms', () => {
    const state = apply({ type: 'quotationFeedback', actor: enterpriseOwner, quotationId: 'quotation-demo', feedback: 'viewed', idempotencyKey: 'view-only' });
    expect(state.quotations[0].status).toBe('客户已查看');
    expect(state.quotations[0].currentVersion).toBe(1);
    expect(state.quotationVersions).toHaveLength(1);
    expect(state.quotationFeedbacks).toHaveLength(1);
    const accepted = apply({ type: 'quotationFeedback', actor: enterpriseOwner, quotationId: 'quotation-demo', feedback: 'accepted', idempotencyKey: 'accept-terms' }, state);
    expect(accepted.quotationVersions).toHaveLength(1);
    expect(accepted.opportunities.some((item) => item.quotationId === 'quotation-demo')).toBe(true);
    expect(accepted.tasks.some((item) => item.idempotencyKey === 'quotation-order-next-quotation-demo')).toBe(true);
  });

  it('lets an assigned provider submit a rectification result but not confirm formal data', () => {
    const state = apply({ type: 'rectificationTaskEvent', actor: provider, taskId: 'rectification-demo', event: 'start' });
    expect(state.rectificationTasks[0].status).toBe('处理中');
    expect(() => apply({ type: 'confirmCandidate', actor: provider, candidateId: 'candidate-product-description', idempotencyKey: 'provider-formal-2' })).toThrowError('SERVICE_PROVIDER_CANNOT_CONFIRM_FORMAL_DATA');
  });

  it('updates only the fulfillment relationships named by the action', () => {
    expect(() => apply({ type: 'fulfillmentNodeEvent', actor: enterpriseOwner, nodeId: 'fulfillment-node-demo', orderId: 'order-demo', event: 'complete', inboundRecordId: 'missing-inbound', inventoryId: 'inventory-demo' })).toThrowError('RELATIONSHIP_INVALID');
  });

  it('applies the compliance gate to generic Product writeback', () => {
    const candidate = { ...demoState.candidates[0], fieldMapping: { description: 'description' }, payload: { description: '候选内容' } };
    const state = { ...demoState, candidates: [candidate, ...demoState.candidates.slice(1)] };
    const result = apply({ type: 'writebackObject', actor: enterpriseOwner, candidateId: candidate.id, idempotencyKey: 'generic-product-gate' }, state);
    expect(result.products[0].status).toBe('需整改');
    expect(result.tasks.some((item) => item.kind === 'publish')).toBe(false);
  });

  it('retries a failed writeback after the source version is refreshed', () => {
    const failed = apply({ type: 'writebackObject', actor: enterpriseOwner, candidateId: 'candidate-lead-profile', idempotencyKey: 'failed-writeback-retry' }, { ...demoState, candidates: [{ ...demoState.candidates[2], fieldMapping: { status: 'status' }, payload: { status: '已入库' } }, ...demoState.candidates.slice(0, 2)] });
    const prepared = { ...failed, candidates: [{ ...failed.candidates[0], fieldMapping: { name: 'name' }, sourceVersion: 1 }, ...failed.candidates.slice(1)] };
    const retried = apply({ type: 'retryWriteback', actor: enterpriseOwner, candidateId: 'candidate-lead-profile', idempotencyKey: 'retry-writeback-1' }, prepared);
    expect(retried.candidates[0].status).toBe('已确认');
    expect(retried.sceneRuns.find((item) => item.id === 'scene-lead-profile')?.status).toBe('已确认');
    expect(retried.tasks.filter((item) => item.idempotencyKey === 'writeback-retry-candidate-lead-profile')).toHaveLength(1);
  });

  it('propagates compliance child changes and review returns to the parent gate', () => {
    const state = apply({ type: 'reviewRecordEvent', actor: enterpriseOwner, reviewId: 'review-demo', event: 'return' }, { ...demoState, complianceCases: [{ ...demoState.complianceCases[0], status: '待复核' as const }] });
    expect(state.complianceCases[0].status).toBe('待整改');
    expect(state.tasks.some((item) => item.idempotencyKey === 'review-return-review-demo')).toBe(true);
    const approved = apply({ type: 'reviewRecordEvent', actor: enterpriseOwner, reviewId: 'review-demo', event: 'approve' }, { ...demoState, complianceCases: [{ ...demoState.complianceCases[0], status: '待复核' as const }], risks: [{ ...demoState.risks[0], status: '已解除' as const }], complianceMaterials: [{ ...demoState.complianceMaterials[0], status: '已确认' as const }], reviewRecords: [{ ...demoState.reviewRecords[0], status: '待复核' as const }] });
    expect(approved.complianceCases[0].status).toBe('已通过');
    expect(approved.products[0].status).toBe('可经营');
  });

  it('creates a new quotation version only for an explicit revision', () => {
    const revised = apply({ type: 'reviseQuotation', actor: enterpriseOwner, quotationId: 'quotation-demo', amount: 13500, combination: ['空运', '保险'], idempotencyKey: 'quote-revision-1' });
    expect(revised.quotationVersions).toHaveLength(2);
    expect(revised.quotationVersions[1].amount).toBe(13500);
    expect(revised.quotationVersions[1].combination).toEqual(['空运', '保险']);
    expect(revised.quotations[0].currentVersion).toBe(2);
  });

  it('rejects role-forged business actions from an otherwise verified user', () => {
    expect(() => apply({ type: 'orderEvent', actor: productOperator, orderId: 'order-demo', event: 'start' })).toThrowError('ROLE_ACTION_DENIED');
    expect(() => apply({ type: 'complianceCaseEvent', actor: productOperator, caseId: 'case-demo', event: 'accept' })).toThrowError('ROLE_ACTION_DENIED');
  });

  it('requires materials and review records before compliance approval', () => {
    const incomplete = { ...demoState, complianceCases: [{ ...demoState.complianceCases[0], status: '待复核' as const }], risks: [{ ...demoState.risks[0], status: '已解除' as const }], complianceMaterials: [], reviewRecords: [] };
    expect(() => apply({ type: 'complianceCaseEvent', actor: enterpriseOwner, caseId: 'case-demo', event: 'approve' }, incomplete)).toThrowError('PREREQUISITE_MISSING');
  });

  it('keeps platform-generated work in the target enterprise scope', () => {
    const platform: Actor = { userId: 'user-platform-operator', organizationId: 'org-platform', projectIds: ['project-wenzhou'], role: 'platform_operator' };
    const state = apply({ type: 'confirmCandidate', actor: platform, candidateId: 'candidate-product-description', idempotencyKey: 'platform-confirm-scope' }, compliantState);
    const task = state.tasks.find((item) => item.idempotencyKey === 'publish-product-product-demo');
    const audit = state.auditLogs.find((item) => item.idempotencyKey === 'platform-confirm-scope');
    expect(task?.organizationId).toBe('org-enterprise-wenzhou');
    expect(audit?.organizationId).toBe('org-enterprise-wenzhou');
  });
});
