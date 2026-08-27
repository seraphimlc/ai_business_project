import { verifyActor, type VerifiedActor } from './permissions';
import type { Actor, DomainState, ObjectType, ProductProgressStatus, ScopedRecord, StatusName, Task } from './types';

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

export interface PlatformOverview { enterprises: number; admissions: number; providers: number; pendingServices: number; openComplianceRisks: number; openFulfillmentRisks: number; projects: number; modes: string[]; }
export interface EnterpriseRow { id: string; name: string; status: string; projectId: string; products: number; orders: number; openRisks: number; activeScenes: number; services: number; }
export interface ProviderRow { id: string; name: string; relations: number; assignedServices: number; activeServices: number; }
export interface ProjectRow { id: string; name: string; region: string; modes: string[]; enabledDomains: string[]; status: string; }
export interface ServiceQueueRow { id: string; inquirySummary: string; orgName: string; status: string; providerId?: string; }
export interface ModeVolumeRow { mode: string; label: string; volume: number; }

function isPlatformOperator(state: DomainState, actor: Actor): VerifiedActor | undefined {
  const trusted = verified(state, actor);
  return trusted && trusted.role === 'platform_operator' ? trusted : undefined;
}
const OPEN_RISK_STATUSES = ['已解除', '已关闭', '已豁免', '已接受'];

export function selectPlatformOverview(state: DomainState, actor: Actor): PlatformOverview {
  const trusted = isPlatformOperator(state, actor); if (!trusted) return { enterprises: 0, admissions: 0, providers: 0, pendingServices: 0, openComplianceRisks: 0, openFulfillmentRisks: 0, projects: 0, modes: [] };
  const enterprises = state.organizations.filter((o) => o.kind === 'enterprise' && o.status === '启用');
  const admissions = state.organizations.filter((o) => o.kind === 'enterprise' && o.status === '待审核');
  const providers = state.organizations.filter((o) => o.kind === 'provider' && o.status === '启用');
  const pendingServices = state.serviceRequests.filter((s) => ['草稿', '待受理', '匹配中', '待选择'].includes(s.status));
  return {
    enterprises: enterprises.length, admissions: admissions.length, providers: providers.length, pendingServices: pendingServices.length,
    openComplianceRisks: state.risks.filter((r) => inScope(r, trusted) && !OPEN_RISK_STATUSES.includes(r.status)).length,
    openFulfillmentRisks: state.riskEvents.filter((r) => inScope(r, trusted) && !OPEN_RISK_STATUSES.includes(r.status)).length,
    projects: state.platformProjects.length, modes: Array.from(new Set(state.platformProjects.flatMap((p) => p.modes))),
  };
}

export function selectEnterpriseRows(state: DomainState, actor: Actor): EnterpriseRow[] {
  const trusted = isPlatformOperator(state, actor); if (!trusted) return [];
  const byOrg = <T extends ScopedRecord>(collection: T[]) => (orgId: string) => collection.filter((r) => r.organizationId === orgId);
  return state.organizations.filter((o) => o.kind === 'enterprise').map((o) => {
    return {
      id: o.id, name: o.name, status: o.status, projectId: o.projectId,
      products: byOrg(state.products)(o.id).length, orders: byOrg(state.orders)(o.id).length,
      openRisks: byOrg(state.risks)(o.id).filter((r) => !OPEN_RISK_STATUSES.includes(r.status)).length,
      activeScenes: byOrg(state.sceneRuns)(o.id).filter((s) => ['处理中', '待确认', '待补充'].includes(s.status)).length,
      services: byOrg(state.serviceRequests)(o.id).length,
    };
  });
}

export function selectProviderRows(state: DomainState, actor: Actor): ProviderRow[] {
  const trusted = isPlatformOperator(state, actor); if (!trusted) return [];
  return state.organizations.filter((o) => o.kind === 'provider' && o.status === '启用').map((o) => {
    const partyIds = new Set(state.partyCompanies.filter((p) => p.organizationId === o.id).map((p) => p.id));
    const assigned = state.serviceRequests.filter((s) => s.providerId === o.id);
    return { id: o.id, name: o.name, relations: state.providerRelations.filter((r) => partyIds.has(r.targetCompanyId)).length, assignedServices: assigned.length, activeServices: assigned.filter((s) => !['已完成', '已取消'].includes(s.status)).length };
  });
}

export function selectProjectRows(state: DomainState, actor: Actor): ProjectRow[] {
  const trusted = isPlatformOperator(state, actor); if (!trusted) return [];
  return state.platformProjects.map((p) => ({ id: p.id, name: p.name, region: p.region, modes: p.modes, enabledDomains: p.enabledDomains, status: p.status }));
}

export function selectServiceQueue(state: DomainState, actor: Actor): ServiceQueueRow[] {
  const trusted = isPlatformOperator(state, actor); if (!trusted) return [];
  return state.serviceRequests.filter((s) => ['草稿', '待受理', '匹配中', '待选择'].includes(s.status)).map((s) => {
    const inquiry = state.inquiries.find((i) => i.id === s.inquiryId);
    const org = state.organizations.find((o) => o.id === s.organizationId);
    return { id: s.id, inquirySummary: inquiry?.summary ?? s.inquiryId, orgName: org?.name ?? '', status: s.status, providerId: s.providerId };
  });
}

export function selectModeVolume(state: DomainState, actor: Actor): ModeVolumeRow[] {
  const trusted = isPlatformOperator(state, actor); if (!trusted) return [];
  const labels: Record<string, string> = { '9810': '海外仓出口', '9710': 'B2B 直接出口', '1039': '市场采购贸易', '9610': '零售直邮' };
  const volume: Record<string, number> = {};
  for (const project of state.platformProjects) {
    const enterpriseOrgs = state.organizations.filter((o) => o.kind === 'enterprise' && o.projectId === project.projectId);
    const carried = enterpriseOrgs.reduce((acc, org) => acc + state.orders.filter((o) => o.organizationId === org.id).length + state.channelListings.filter((c) => c.organizationId === org.id).length, 0);
    project.modes.forEach((mode) => { volume[mode] = (volume[mode] || 0) + Math.max(carried, 1); });
  }
  return Object.entries(volume).map(([mode, v]) => ({ mode, label: labels[mode] ?? mode, volume: v }));
}
