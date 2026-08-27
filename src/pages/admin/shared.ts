import type { Actor } from '../../domain/types';

export const PLATFORM_ACTOR: Actor = { userId: 'user-platform-operator', organizationId: 'org-platform', projectIds: ['project-wenzhou', 'project-nanjing'], role: 'platform_operator' };

export const MODE_LABELS: Record<string, string> = { '9810': '海外仓出口', '9710': 'B2B 直接出口', '1039': '市场采购贸易', '9610': '零售直邮' };

export const ALL_DOMAINS = ['市场判断与选品', '商品建档与内容经营', '营销内容与社媒经营', '获客与客户经营', '询价与报价', '服务与物流', '订单与供应链', '库存与入库', '经营分析与报告', '合规处理'];
