import type {
  AuditLog, CandidateResult, ChannelListing, ComplianceCase, Contact, CustomerProfile, CustomerRelation, DataTask,
  DomainState, FileAsset, Fulfillment, FulfillmentNode, InboundRecord, Inquiry, IntegrationRecord, Inventory,
  Lead, LogisticsQuote, MatchResult, Notification, Opportunity, Order, Organization, PartyCompany, Product,
  ProductAsset, ProductAttribute, ProductVersion, ProjectMembership, ProviderRelation, Quotation, QuotationVersion, QuotationFeedback,
  RectificationTask, Report, ReviewRecord, RiskEvent, RiskItem, Role, RuleConfiguration, SceneRun, ServiceRequest,
  SKU, SupplierRelation, Task, TouchTask, User, VersionRecord, FollowUp, ComplianceMaterial,
} from './types';

const createdAt = '2026-08-27T00:00:00.000Z';
const updatedAt = '2026-08-27T01:00:00.000Z';
const scope = (id: string, organizationId = 'org-enterprise-wenzhou', projectId = 'project-wenzhou') => ({ id, organizationId, projectId, createdAt, updatedAt });

export const organizations: Organization[] = [
  { ...scope('org-platform', 'org-platform', 'platform'), projectId: 'platform', name: '跨境场景平台', kind: 'platform', status: '启用' },
  { ...scope('org-enterprise-wenzhou', 'org-enterprise-wenzhou'), name: '温州智造企业', kind: 'enterprise', status: '启用' },
  { ...scope('org-enterprise-nanjing', 'org-enterprise-nanjing', 'project-nanjing'), name: '南京出海企业', kind: 'enterprise', status: '启用' },
  { ...scope('org-service-provider', 'org-service-provider'), name: '远航合规服务商', kind: 'provider', status: '启用' },
];

export const roles: Role[] = (['enterprise_owner', 'product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'service_provider', 'platform_operator'] as const).map((code) => ({ ...scope(`role-${code}`, code === 'platform_operator' ? 'org-platform' : code === 'service_provider' ? 'org-service-provider' : 'org-enterprise-wenzhou'), name: code, code, status: '启用' }));
export const users: User[] = [
  { ...scope('user-enterprise-owner'), name: '林负责人', roleId: 'role-enterprise_owner', status: '启用' },
  { ...scope('user-product-operator'), name: '周商品运营', roleId: 'role-product_operator', status: '启用' },
  { ...scope('user-provider', 'org-service-provider'), name: '顾服务商', roleId: 'role-service_provider', status: '启用' },
  { ...scope('user-platform-operator', 'org-platform', 'platform'), name: '赵平台运营', roleId: 'role-platform_operator', status: '启用' },
];
export const projectMemberships: ProjectMembership[] = [
  { ...scope('membership-owner'), userId: 'user-enterprise-owner', roleId: 'role-enterprise_owner', status: '启用' },
  { ...scope('membership-product'), userId: 'user-product-operator', roleId: 'role-product_operator', status: '启用' },
  { ...scope('membership-provider', 'org-service-provider'), userId: 'user-provider', roleId: 'role-service_provider', status: '启用' },
  { ...scope('membership-platform-wenzhou', 'org-platform', 'project-wenzhou'), userId: 'user-platform-operator', roleId: 'role-platform_operator', status: '启用' },
];

const partyCompanies: PartyCompany[] = [
  { ...scope('party-enterprise'), name: '温州智造企业', kind: 'enterprise', status: '有效' },
  { ...scope('party-buyer'), name: 'Global Warehouse Buyer', kind: 'customer', status: '有效' },
  { ...scope('party-supplier'), name: '华东钢材供应商', kind: 'supplier', status: '有效' },
  { ...scope('party-provider', 'org-service-provider'), name: '远航合规服务商', kind: 'provider', status: '有效' },
];
const contacts: Contact[] = [{ ...scope('contact-buyer'), partyCompanyId: 'party-buyer', name: 'Mia Carter', email: 'mia@example.com', status: '有效' }];
const relation = (id: string, target: string) => ({ ...scope(id), sourceCompanyId: 'party-enterprise', targetCompanyId: target, status: '有效' as const });
const customerRelations: CustomerRelation[] = [relation('customer-relation-demo', 'party-buyer') as CustomerRelation];
const supplierRelations: SupplierRelation[] = [relation('supplier-relation-demo', 'party-supplier') as SupplierRelation];
const providerRelations: ProviderRelation[] = [relation('provider-relation-demo', 'party-provider') as ProviderRelation];

const products: Product[] = [{ ...scope('product-demo'), name: '仓储货架', description: 'Steel storage rack', ownerId: 'user-product-operator', status: '草稿', currentVersion: 1 }];
const skus: SKU[] = [{ ...scope('sku-demo'), productId: 'product-demo', code: 'RACK-001', status: '草稿' }];
const productAttributes: ProductAttribute[] = [{ ...scope('attribute-demo'), productId: 'product-demo', name: '材质', value: '钢', status: '草稿' }];
const files: FileAsset[] = [{ ...scope('file-product-image'), name: 'rack-demo.jpg', status: '可用' }, { ...scope('file-compliance'), name: 'certificate.pdf', status: '已上传' }];
const productAssets: ProductAsset[] = [{ ...scope('asset-product-image'), productId: 'product-demo', kind: 'image', fileAssetId: 'file-product-image', status: '待确认' }];
const productVersions: ProductVersion[] = [{ ...scope('product-version-1'), productId: 'product-demo', version: 1, description: 'Steel storage rack', status: '已生效', createdBy: 'user-product-operator' }];
const channelListings: ChannelListing[] = [{ ...scope('listing-demo'), productId: 'product-demo', channel: '跨境商城', status: '待发布' }];

const leads: Lead[] = [{ ...scope('lead-demo'), name: 'Global Warehouse Buyer', companyId: 'party-buyer', version: 1, status: '待筛选' }];
const customerProfiles: CustomerProfile[] = [{ ...scope('profile-demo'), companyId: 'party-buyer', summary: 'North American warehouse procurement team', status: '待确认' }];
const touchTasks: TouchTask[] = [{ ...scope('touch-demo'), leadId: 'lead-demo', ownerId: 'user-product-operator', status: '待执行' }];
const followUps: FollowUp[] = [{ ...scope('follow-up-demo'), leadId: 'lead-demo', ownerId: 'user-product-operator', status: '待跟进' }];
const opportunities: Opportunity[] = [];

const inquiries: Inquiry[] = [{ ...scope('inquiry-demo'), customerId: 'party-buyer', summary: 'Need warehouse racks for 3 sites', status: '已确认' }];
const matchResults: MatchResult[] = [{ ...scope('match-demo'), inquiryId: 'inquiry-demo', selectedObjectId: 'product-demo', status: '待选择' }];
const serviceRequests: ServiceRequest[] = [{ ...scope('service-request-demo'), inquiryId: 'inquiry-demo', status: '待选择' }];
const logisticsQuotes: LogisticsQuote[] = [{ ...scope('logistics-quote-demo'), inquiryId: 'inquiry-demo', amount: 1200, status: '待选择' }];
const quotations: Quotation[] = [{ ...scope('quotation-demo'), inquiryId: 'inquiry-demo', currentVersion: 1, amount: 12000, combination: ['海运', '基础保险'], status: '已发送' }];
const quotationVersions: QuotationVersion[] = [{ ...scope('quotation-version-1'), quotationId: 'quotation-demo', version: 1, amount: 12000, combination: ['海运', '基础保险'], status: '已生效' }];
const quotationFeedbacks: QuotationFeedback[] = [];

const complianceCases: ComplianceCase[] = [{ ...scope('case-demo'), subjectType: 'Product', subjectId: 'product-demo', scope: '境外', status: '待整改' }];
const risks: RiskItem[] = [{ ...scope('risk-demo'), caseId: 'case-demo', title: '缺少材质证明', status: '已确认' }];
const rectificationTasks: RectificationTask[] = [{ ...scope('rectification-demo'), riskId: 'risk-demo', ownerId: 'user-provider', status: '待处理' }];
const complianceMaterials: ComplianceMaterial[] = [{ ...scope('material-demo'), caseId: 'case-demo', fileAssetId: 'file-compliance', status: '已提交' }];
const reviewRecords: ReviewRecord[] = [{ ...scope('review-demo'), caseId: 'case-demo', reviewerId: 'user-enterprise-owner', status: '待复核' }];

const orders: Order[] = [{ ...scope('order-demo'), customerId: 'party-buyer', status: '执行中' }];
const fulfillments: Fulfillment[] = [{ ...scope('fulfillment-demo'), orderId: 'order-demo', status: '处理中' }];
const fulfillmentNodes: FulfillmentNode[] = [{ ...scope('fulfillment-node-demo'), fulfillmentId: 'fulfillment-demo', name: '备货', status: '处理中' }];
const riskEvents: RiskEvent[] = [];
const inventories: Inventory[] = [{ ...scope('inventory-demo'), skuId: 'sku-demo', quantity: 80, status: '可用' }];
const inboundRecords: InboundRecord[] = [{ ...scope('inbound-demo'), orderId: 'order-demo', quantity: 20, status: '待入库' }];

const sceneRuns: SceneRun[] = [
  { ...scope('scene-product-demo'), sceneType: 'product-content', initiatedBy: 'user-product-operator', targetObject: { type: 'Product', id: 'product-demo' }, status: '待确认', sourceEndpoint: '小程序' },
  { ...scope('scene-failed'), sceneType: 'product-content', initiatedBy: 'user-product-operator', targetObject: { type: 'Product', id: 'product-demo' }, status: '失败', sourceEndpoint: 'Web' },
  { ...scope('scene-rule-indeterminate'), sceneType: 'compliance-review', initiatedBy: 'user-product-operator', targetObject: { type: 'ComplianceCase', id: 'case-demo' }, status: '处理中', sourceEndpoint: 'Web' },
  { ...scope('scene-lead-profile'), sceneType: 'lead-profile', initiatedBy: 'user-product-operator', targetObject: { type: 'Lead', id: 'lead-demo' }, status: '待确认', sourceEndpoint: 'Web' },
];
const candidates: CandidateResult[] = [
  { ...scope('candidate-product-description'), sceneRunId: 'scene-product-demo', targetObject: { type: 'Product', id: 'product-demo' }, sourceVersion: 1, candidateVersion: 1, payload: { description: 'Industrial storage rack for global warehouses.' }, sourcePayload: { description: 'Industrial storage rack for global warehouses.' }, fieldMapping: { description: 'description' }, status: '待确认', idempotencyKey: 'candidate-product-description' },
  { ...scope('candidate-stale-product'), sceneRunId: 'scene-product-demo', targetObject: { type: 'Product', id: 'product-demo' }, sourceVersion: 0, candidateVersion: 1, payload: { description: 'Stale description' }, sourcePayload: { description: 'Stale description' }, fieldMapping: { description: 'description' }, status: '待确认', idempotencyKey: 'candidate-stale-product' },
  { ...scope('candidate-lead-profile'), sceneRunId: 'scene-lead-profile', targetObject: { type: 'Lead', id: 'lead-demo' }, sourceVersion: 1, candidateVersion: 1, payload: { name: 'Global Warehouse Buyer / confirmed' }, sourcePayload: { name: 'Global Warehouse Buyer / confirmed' }, fieldMapping: { name: 'name' }, status: '待确认', idempotencyKey: 'candidate-lead-profile' },
];
const tasks: Task[] = [
  { ...scope('task-product-confirm'), title: '确认商品候选描述', kind: 'confirmation', objectType: 'Product', objectId: 'product-demo', assigneeId: 'user-enterprise-owner', status: '待确认' },
  { ...scope('task-owner-only'), title: '仅负责人可完成', kind: 'confirmation', objectType: 'Product', objectId: 'product-demo', assigneeId: 'user-enterprise-owner', status: '待处理' },
  { ...scope('task-provider-risk'), title: '补充合规材料', kind: 'risk_review', objectType: 'ComplianceCase', objectId: 'case-demo', assigneeId: 'user-provider', status: '待处理' },
];
const notifications: Notification[] = [{ ...scope('notification-risk'), recipientId: 'user-enterprise-owner', title: '商品存在待整改风险', status: '已发送', idempotencyKey: 'risk-demo-notice' }];
const versionRecords: VersionRecord[] = [{ ...scope('version-record-product-1'), objectType: 'Product', objectId: 'product-demo', version: 1, status: '正式' }];
const auditLogs: AuditLog[] = [{ ...scope('audit-product-created'), actorId: 'user-product-operator', action: 'product.created', objectType: 'Product', objectId: 'product-demo', status: '已记录', after: { status: '草稿' } }];

const empty = <T>(): T[] => [];
const reports: Report[] = empty();
const dataTasks: DataTask[] = empty();
const ruleConfigurations: RuleConfiguration[] = [{ ...scope('rule-config-demo'), name: '境外商品合规规则', version: '2026.08', status: '已生效' }];
const integrations: IntegrationRecord[] = empty();

export const demoState: DomainState = {
  organizations, users, roles, projectMemberships, partyCompanies, contacts, customerRelations, supplierRelations, providerRelations,
  products, skus, productAttributes, productAssets, productVersions, channelListings, leads, customerProfiles, touchTasks, followUps, opportunities,
  inquiries, matchResults, serviceRequests, logisticsQuotes, quotations, quotationVersions, quotationFeedbacks, complianceCases, risks, rectificationTasks, complianceMaterials,
  reviewRecords, orders, fulfillments, fulfillmentNodes, riskEvents, inventories, inboundRecords, reports, dataTasks, ruleConfigurations, sceneRuns,
  candidates, tasks, notifications, files, versionRecords, auditLogs, integrations,
};

export function createInitialState(): DomainState {
  return structuredClone(demoState);
}
