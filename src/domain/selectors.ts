import { verifyActor, type VerifiedActor } from './permissions';
import type { Actor, DomainState, ObjectType, ProductProgressStatus, StatusName, Task } from './types';

export interface DashboardSummary { pendingTasks: number; openRisks: number; activeScenes: number; products: number; }
export interface ProductProgress { lifecycle: DomainState['products'][number]['status']; content: ProductProgressStatus; compliance: ProductProgressStatus; channel: ProductProgressStatus; }
export interface VisibleRecords { products: DomainState['products']; leads: DomainState['leads']; complianceCases: DomainState['complianceCases']; quotations: DomainState['quotations']; orders: DomainState['orders']; tasks: DomainState['tasks']; }
export interface TimelineEntry { id: string; kind: 'scene' | 'audit' | 'task'; at: string; label: string; status?: StatusName; }

function verified(state: DomainState, actor: Actor): VerifiedActor | undefined { return verifyActor(state, actor); }
function inScope(item: { organizationId: string; projectId: string }, actor: VerifiedActor): boolean { return actor.projectIds.includes(item.projectId) && (actor.role === 'platform_operator' || item.organizationId === actor.organizationId); }

export function selectDashboardSummary(state: DomainState, actor: Actor): DashboardSummary {
  const trusted = verified(state, actor); if (!trusted) return { pendingTasks: 0, openRisks: 0, activeScenes: 0, products: 0 };
  const records = selectRoleVisibleRecords(state, trusted);
  return { pendingTasks: records.tasks.filter((item) => !['已完成', '已取消'].includes(item.status)).length, openRisks: state.risks.filter((item) => inScope(item, trusted) && !['已解除', '已关闭', '已豁免'].includes(item.status)).length, activeScenes: state.sceneRuns.filter((item) => inScope(item, trusted) && ['处理中', '待确认', '待补充'].includes(item.status)).length, products: records.products.length };
}

export function selectObjectProgress(state: DomainState, objectType: ObjectType, objectId: string, actor: Actor): ProductProgress {
  if (objectType !== 'Product') throw new Error('PRODUCT_PROGRESS_REQUIRES_PRODUCT');
  const trusted = verified(state, actor); if (!trusted) throw new Error('ACTOR_NOT_AUTHORIZED');
  const product = state.products.find((item) => item.id === objectId && inScope(item, trusted)); if (!product) throw new Error('NOT_FOUND');
  const contentCandidate = state.candidates.find((item) => item.targetObject.type === 'Product' && item.targetObject.id === objectId && item.status === '待确认');
  const compliance = state.complianceCases.find((item) => item.subjectType === 'Product' && item.subjectId === objectId);
  const listing = state.channelListings.find((item) => item.productId === objectId);
  return { lifecycle: product.status, content: contentCandidate ? '待确认' : product.description ? '已完成' : '未开始', compliance: compliance?.status === '待整改' ? '待整改' : compliance?.status === '已通过' ? '已完成' : compliance ? '处理中' : '未开始', channel: listing?.status === '已发布' ? '已完成' : listing?.status === '发布中' ? '处理中' : listing ? '待发布' : '未开始' };
}

export function selectRoleVisibleRecords(state: DomainState, actor: Actor): VisibleRecords {
  const trusted = verified(state, actor); if (!trusted) return { products: [], leads: [], complianceCases: [], quotations: [], orders: [], tasks: [] };
  const tasks = trusted.role === 'service_provider' ? state.tasks.filter((item) => item.assigneeId === trusted.userId) : state.tasks.filter((item) => inScope(item, trusted));
  const visibleCaseIds = trusted.role === 'service_provider' ? state.rectificationTasks.filter((item) => item.ownerId === trusted.userId).map((item) => state.risks.find((risk) => risk.id === item.riskId)?.caseId).filter((id): id is string => Boolean(id)) : state.complianceCases.filter((item) => inScope(item, trusted)).map((item) => item.id);
  return { products: trusted.role === 'service_provider' ? [] : state.products.filter((item) => inScope(item, trusted)), leads: trusted.role === 'service_provider' ? [] : state.leads.filter((item) => inScope(item, trusted)), complianceCases: state.complianceCases.filter((item) => visibleCaseIds.includes(item.id)), quotations: trusted.role === 'service_provider' ? [] : state.quotations.filter((item) => inScope(item, trusted)), orders: trusted.role === 'service_provider' ? [] : state.orders.filter((item) => inScope(item, trusted)), tasks };
}

export function selectPendingTasks(state: DomainState, actor: Actor): Task[] { return selectRoleVisibleRecords(state, actor).tasks.filter((item) => !['已完成', '已取消'].includes(item.status)); }

export function selectTimeline(state: DomainState, objectType: ObjectType, objectId: string, actor: Actor): TimelineEntry[] {
  const trusted = verified(state, actor); if (!trusted) return [];
  const entries: TimelineEntry[] = [
    ...state.sceneRuns.filter((item) => item.targetObject.type === objectType && item.targetObject.id === objectId && inScope(item, trusted)).map((item) => ({ id: item.id, kind: 'scene' as const, at: item.updatedAt, label: `场景处理: ${item.sceneType}`, status: item.status as StatusName })),
    ...state.auditLogs.filter((item) => item.objectType === objectType && item.objectId === objectId && inScope(item, trusted)).map((item) => ({ id: item.id, kind: 'audit' as const, at: item.createdAt, label: item.action })),
    ...state.tasks.filter((item) => item.objectType === objectType && item.objectId === objectId && inScope(item, trusted)).map((item) => ({ id: item.id, kind: 'task' as const, at: item.updatedAt, label: item.title, status: item.status as StatusName })),
  ];
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}
