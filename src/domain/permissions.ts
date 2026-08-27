import type { Actor, DomainAction, DomainState, RoleName, ScopedRecord } from './types';

export interface VerifiedActor extends Actor { role: RoleName; }

export const ACTION_ROLE_AUTHORIZATION: Record<Exclude<DomainAction['type'], 'resetDemo'>, readonly RoleName[]> = {
  createProductDraft: ['enterprise_owner', 'product_operator', 'platform_operator'], updateProductDraft: ['enterprise_owner', 'product_operator', 'platform_operator'], uploadProductAsset: ['enterprise_owner', 'product_operator', 'platform_operator'], publishProduct: ['enterprise_owner', 'product_operator', 'platform_operator'], processProductContent: ['enterprise_owner', 'product_operator', 'platform_operator'], startScene: ['enterprise_owner', 'product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'platform_operator'], processingComplete: ['product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'platform_operator'], confirmCandidate: ['enterprise_owner', 'product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'platform_operator'], rejectCandidate: ['enterprise_owner', 'product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'platform_operator'], writebackObject: ['enterprise_owner', 'product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'platform_operator'], retryWriteback: ['enterprise_owner', 'product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'platform_operator'],
  assignTask: ['enterprise_owner', 'compliance_operator', 'platform_operator'], completeTask: ['enterprise_owner', 'product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'service_provider', 'platform_operator'], returnTask: ['enterprise_owner', 'product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'service_provider', 'platform_operator'], retryScene: ['product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'platform_operator'], markSceneFailure: ['product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'platform_operator'],
  leadEvent: ['enterprise_owner', 'sales_operator', 'product_operator', 'platform_operator'], complianceCaseEvent: ['enterprise_owner', 'compliance_operator', 'platform_operator'], complianceMaterialEvent: ['enterprise_owner', 'compliance_operator', 'service_provider', 'platform_operator'], riskItemEvent: ['enterprise_owner', 'compliance_operator', 'platform_operator'], rectificationTaskEvent: ['enterprise_owner', 'compliance_operator', 'service_provider', 'platform_operator'], reviewRecordEvent: ['enterprise_owner', 'compliance_operator', 'platform_operator'], inquiryEvent: ['enterprise_owner', 'sales_operator', 'platform_operator'], matchResultEvent: ['enterprise_owner', 'sales_operator', 'product_operator', 'platform_operator'], quotationEvent: ['enterprise_owner', 'sales_operator', 'platform_operator'], orderEvent: ['enterprise_owner', 'fulfillment_operator', 'platform_operator'], riskResolve: ['enterprise_owner', 'compliance_operator', 'platform_operator'], quotationFeedback: ['enterprise_owner', 'sales_operator', 'platform_operator', 'customer'], customerSubmitInquiry: ['customer'], createQuotationVersion: ['enterprise_owner', 'sales_operator', 'platform_operator'], reviseQuotation: ['enterprise_owner', 'sales_operator', 'platform_operator'], fulfillmentNodeEvent: ['enterprise_owner', 'fulfillment_operator', 'platform_operator'], riskEventEvent: ['enterprise_owner', 'fulfillment_operator', 'platform_operator'], inventoryEvent: ['enterprise_owner', 'fulfillment_operator', 'platform_operator'], inboundRecordEvent: ['enterprise_owner', 'fulfillment_operator', 'platform_operator'], approveEnterpriseAdmission: ['platform_operator'], rejectEnterpriseAdmission: ['platform_operator'], toggleProjectDomain: ['platform_operator'], assignServiceRequest: ['platform_operator'],
};

export function isActionAuthorized(role: RoleName, actionType: DomainAction['type']): boolean {
  return actionType !== 'resetDemo' && ACTION_ROLE_AUTHORIZATION[actionType].includes(role);
}

export function resolveActor(state: DomainState, userId: string): VerifiedActor | undefined {
  const user = state.users.find((item) => item.id === userId);
  if (!user || user.status !== '启用') return undefined;
  const role = state.roles.find((item) => item.id === user.roleId && item.status === '启用');
  const memberships = state.projectMemberships.filter((item) => item.userId === user.id && item.roleId === user.roleId && item.status === '启用');
  const organization = state.organizations.find((item) => item.id === user.organizationId && item.status === '启用');
  if (!role || !organization || memberships.length === 0 || role.organizationId !== user.organizationId) return undefined;
  return { userId: user.id, organizationId: user.organizationId, projectIds: memberships.map((item) => item.projectId), role: role.code };
}

export function verifyActor(state: DomainState, supplied: Actor): VerifiedActor | undefined {
  const actor = resolveActor(state, supplied.userId);
  if (!actor) return undefined;
  const sameProjects = actor.projectIds.length === supplied.projectIds.length && actor.projectIds.every((id) => supplied.projectIds.includes(id));
  if (actor.organizationId !== supplied.organizationId || actor.role !== supplied.role || !sameProjects) return undefined;
  return actor;
}

export function isAuthorizedRecord(state: DomainState, actor: VerifiedActor, record: ScopedRecord): boolean {
  if (!actor.projectIds.includes(record.projectId)) return false;
  if (actor.role === 'platform_operator') return true;
  return record.organizationId === actor.organizationId;
}

export function canEditRole(role: RoleName): boolean {
  return ['enterprise_owner', 'product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'platform_operator'].includes(role);
}
