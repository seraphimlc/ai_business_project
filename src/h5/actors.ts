import type { Actor } from '../domain/types';

// H5 端唯一用户：档口业主（个体商户老板，管理自己的商品）
export const STALL_OWNER_ACTOR: Actor = { userId: 'user-stall-owner', organizationId: 'org-enterprise-wenzhou', projectIds: ['project-wenzhou'], role: 'enterprise_owner' };

export const ACTOR = STALL_OWNER_ACTOR;
