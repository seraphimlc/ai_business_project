import type {
  AuditLog, CandidateResult, ChannelListing, ComplianceCase, Contact, CustomerProfile, CustomerRelation, DataTask,
  DomainState, FileAsset, Fulfillment, FulfillmentNode, InboundRecord, Inquiry, IntegrationRecord, Inventory,
  Lead, LogisticsQuote, MatchResult, Notification, Opportunity, Order, Organization, PartyCompany, PlatformListing, PlatformProject, Product,
  ProductAsset, ProductAttribute, ProductCandidate, ProductCert, ProductVersion, ProjectMembership, ProviderRelation, Quotation, QuotationVersion, QuotationFeedback,
  RectificationTask, Report, ReviewRecord, RiskEvent, RiskItem, Role, RuleConfiguration, SceneRun, ServiceRequest,
  SKU, SourceOffer, SupplierRelation, Task, TouchTask, User, VersionRecord, FollowUp, ComplianceMaterial,
} from './types';

const createdAt = '2026-08-27T00:00:00.000Z';
const updatedAt = '2026-08-27T01:00:00.000Z';
const scope = (id: string, organizationId = 'org-enterprise-wenzhou', projectId = 'project-wenzhou') => ({ id, organizationId, projectId, createdAt, updatedAt });

export const organizations: Organization[] = [
  { ...scope('org-platform', 'org-platform', 'platform'), projectId: 'platform', name: '跨境场景平台', kind: 'platform', status: '启用' },
  { ...scope('org-enterprise-wenzhou', 'org-enterprise-wenzhou'), name: '温州智造企业', kind: 'enterprise', status: '启用' },
  { ...scope('org-enterprise-nanjing', 'org-enterprise-nanjing', 'project-nanjing'), name: '南京出海企业', kind: 'enterprise', status: '启用' },
  { ...scope('org-enterprise-ningbo', 'org-enterprise-ningbo'), name: '宁波家居企业', kind: 'enterprise', status: '待审核' },
  { ...scope('org-service-provider', 'org-service-provider'), name: '远航合规服务商', kind: 'provider', status: '启用' },
  { ...scope('org-provider-logistics', 'org-provider-logistics'), name: '通达国际物流', kind: 'provider', status: '启用' },
];

export const roles: Role[] = (['enterprise_owner', 'product_operator', 'sales_operator', 'compliance_operator', 'fulfillment_operator', 'service_provider', 'platform_operator', 'customer'] as const).map((code) => ({ ...scope(`role-${code}`, code === 'platform_operator' ? 'org-platform' : code === 'service_provider' ? 'org-service-provider' : 'org-enterprise-wenzhou'), name: code, code, status: '启用' }));
export const users: User[] = [
  { ...scope('user-enterprise-owner'), name: '林负责人', roleId: 'role-enterprise_owner', status: '启用' },
  { ...scope('user-product-operator'), name: '周商品运营', roleId: 'role-product_operator', status: '启用' },
  { ...scope('user-provider', 'org-service-provider'), name: '顾服务商', roleId: 'role-service_provider', status: '启用' },
  { ...scope('user-platform-operator', 'org-platform', 'platform'), name: '赵平台运营', roleId: 'role-platform_operator', status: '启用' },
  { ...scope('user-buyer'), name: 'Mia Carter', roleId: 'role-customer', status: '启用', partyCompanyId: 'party-buyer' },
  { ...scope('user-stall-owner'), name: '陈档口主', roleId: 'role-enterprise_owner', status: '启用', partyCompanyId: 'party-stall' },
];
export const projectMemberships: ProjectMembership[] = [
  { ...scope('membership-owner'), userId: 'user-enterprise-owner', roleId: 'role-enterprise_owner', status: '启用' },
  { ...scope('membership-product'), userId: 'user-product-operator', roleId: 'role-product_operator', status: '启用' },
  { ...scope('membership-provider', 'org-service-provider'), userId: 'user-provider', roleId: 'role-service_provider', status: '启用' },
  { ...scope('membership-platform-wenzhou', 'org-platform', 'project-wenzhou'), userId: 'user-platform-operator', roleId: 'role-platform_operator', status: '启用' },
  { ...scope('membership-platform-nanjing', 'org-platform', 'project-nanjing'), userId: 'user-platform-operator', roleId: 'role-platform_operator', status: '启用' },
  { ...scope('membership-buyer'), userId: 'user-buyer', roleId: 'role-customer', status: '启用' },
  { ...scope('membership-stall'), userId: 'user-stall-owner', roleId: 'role-enterprise_owner', status: '启用' },
];

const partyCompanies: PartyCompany[] = [
  { ...scope('party-enterprise'), name: '温州智造企业', kind: 'enterprise', status: '有效' },
  { ...scope('party-stall'), name: '陈记档口', kind: 'enterprise', status: '有效' },
  { ...scope('party-enterprise-ningbo', 'org-enterprise-ningbo'), name: '宁波家居企业', kind: 'enterprise', status: '草稿' },
  { ...scope('party-buyer'), name: 'Global Warehouse Buyer', kind: 'customer', status: '有效' },
  { ...scope('party-supplier'), name: '华东钢材供应商', kind: 'supplier', status: '有效' },
  { ...scope('party-provider', 'org-service-provider'), name: '远航合规服务商', kind: 'provider', status: '有效' },
  { ...scope('party-provider-logistics', 'org-provider-logistics'), name: '通达国际物流', kind: 'provider', status: '有效' },
];
const contacts: Contact[] = [{ ...scope('contact-buyer'), partyCompanyId: 'party-buyer', name: 'Mia Carter', email: 'mia@example.com', status: '有效' }];
const relation = (id: string, target: string) => ({ ...scope(id), sourceCompanyId: 'party-enterprise', targetCompanyId: target, status: '有效' as const });
const customerRelations: CustomerRelation[] = [relation('customer-relation-demo', 'party-buyer') as CustomerRelation];
const supplierRelations: SupplierRelation[] = [relation('supplier-relation-demo', 'party-supplier') as SupplierRelation];
const providerRelations: ProviderRelation[] = [relation('provider-relation-demo', 'party-provider') as ProviderRelation, relation('provider-relation-logistics', 'party-provider-logistics') as ProviderRelation];

const products: Product[] = [
  { ...scope('product-demo'), name: '仓储货架', description: 'Steel storage rack', ownerId: 'user-product-operator', status: '草稿', currentVersion: 1 },
  { ...scope('product-ningbo', 'org-enterprise-ningbo'), name: '藤编收纳篮', description: 'Rattan storage basket', ownerId: 'user-product-operator', status: '可经营', currentVersion: 1 },
  { ...scope('product-rack-pro'), name: '重型仓储货架', description: 'Heavy-duty steel pallet rack, 3-tier, 2.5m', ownerId: 'user-product-operator', status: '可经营', currentVersion: 1, price: 1280, unit: '组', category: '仓储设备' },
  { ...scope('product-basket-rattan'), name: '藤编收纳篮三件套', description: 'Rattan woven storage basket set of 3', ownerId: 'user-product-operator', status: '可经营', currentVersion: 1, price: 268, unit: '套', category: '家居收纳' },
  { ...scope('product-lamp-led'), name: 'LED 感应壁灯', description: 'Motion-sensor LED wall lamp, 4000K', ownerId: 'user-product-operator', status: '可经营', currentVersion: 1, price: 96, unit: '个', category: '灯具照明' },
  { ...scope('product-pot-cast'), name: '铸铁珐琅炖锅', description: 'Cast iron enamel dutch oven 4.5L', ownerId: 'user-product-operator', status: '可经营', currentVersion: 1, price: 459, unit: '口', category: '厨具餐厨' },
  { ...scope('product-tool-set'), name: '家用工具套装', description: '45-piece household tool kit', ownerId: 'user-product-operator', status: '可经营', currentVersion: 1, price: 189, unit: '套', category: '五金工具' },
  { ...scope('product-textile-bed'), name: '磨毛四件套', description: 'Brushed cotton bedding set, 4 pieces', ownerId: 'user-product-operator', status: '可经营', currentVersion: 1, price: 328, unit: '套', category: '家纺布艺' },
  { ...scope('product-stall-rack'), name: '镀锌仓储货架', description: 'Galvanized steel rack, 2.4m, 承重 500kg/层', ownerId: 'user-stall-owner', status: '可经营', currentVersion: 1, price: 1380, unit: '组', category: '仓储设备' },
  { ...scope('product-stall-basket'), name: '编织收纳篮', description: 'Woven storage basket', ownerId: 'user-stall-owner', status: '草稿', currentVersion: 1 },
  { ...scope('product-stall-lamp'), name: '太阳能庭院灯', description: 'Solar garden lamp, 6 支装', ownerId: 'user-stall-owner', status: '待完善', currentVersion: 1, price: 89, unit: '组', category: '灯具照明' },
];
const skus: SKU[] = [{ ...scope('sku-demo'), productId: 'product-demo', code: 'RACK-001', status: '草稿' }];
const productAttributes: ProductAttribute[] = [{ ...scope('attribute-demo'), productId: 'product-demo', name: '材质', value: '钢', status: '草稿' }];
const files: FileAsset[] = [{ ...scope('file-product-image'), name: 'rack-demo.jpg', status: '可用' }, { ...scope('file-compliance'), name: 'certificate.pdf', status: '已上传' }, { ...scope('file-stall-rack'), name: 'rack-galvanized.jpg', status: '可用' }, { ...scope('file-stall-lamp'), name: 'solar-lamp-1.jpg', status: '可用' }];
const productAssets: ProductAsset[] = [{ ...scope('asset-product-image'), productId: 'product-demo', kind: 'image', fileAssetId: 'file-product-image', status: '待确认' }, { ...scope('asset-stall-rack'), productId: 'product-stall-rack', kind: 'image', fileAssetId: 'file-stall-rack', status: '已确认' }, { ...scope('asset-stall-lamp'), productId: 'product-stall-lamp', kind: 'image', fileAssetId: 'file-stall-lamp', status: '已确认' }];
const productVersions: ProductVersion[] = [{ ...scope('product-version-1'), productId: 'product-demo', version: 1, description: 'Steel storage rack', status: '已生效', createdBy: 'user-product-operator' }, { ...scope('product-version-stall-1'), productId: 'product-stall-rack', version: 1, description: 'Galvanized steel rack, 2.4m, 承重 500kg/层', status: '已生效', createdBy: 'user-stall-owner' }];
const channelListings: ChannelListing[] = [{ ...scope('listing-demo'), productId: 'product-demo', channel: '跨境商城', status: '待发布' }];

const leads: Lead[] = [{ ...scope('lead-demo'), name: 'Global Warehouse Buyer', companyId: 'party-buyer', version: 1, status: '待筛选' }];
const customerProfiles: CustomerProfile[] = [{ ...scope('profile-demo'), companyId: 'party-buyer', summary: 'North American warehouse procurement team', status: '待确认' }];
const touchTasks: TouchTask[] = [{ ...scope('touch-demo'), leadId: 'lead-demo', ownerId: 'user-product-operator', status: '待执行' }];
const followUps: FollowUp[] = [{ ...scope('follow-up-demo'), leadId: 'lead-demo', ownerId: 'user-product-operator', status: '待跟进' }];
const opportunities: Opportunity[] = [];

const inquiries: Inquiry[] = [
  { ...scope('inquiry-demo'), customerId: 'party-buyer', summary: 'Need warehouse racks for 3 sites', status: '已确认' },
  { ...scope('inquiry-logistics', 'org-enterprise-ningbo'), customerId: 'party-enterprise-ningbo', summary: '宁波家居整柜海运至洛杉矶', status: '处理中' },
  { ...scope('inquiry-compliance', 'org-enterprise-ningbo'), customerId: 'party-enterprise-ningbo', summary: '藤编收纳篮境外合规评估', status: '处理中' },
];
const matchResults: MatchResult[] = [{ ...scope('match-demo'), inquiryId: 'inquiry-demo', selectedObjectId: 'product-demo', status: '待选择' }];
const serviceRequests: ServiceRequest[] = [
  { ...scope('service-request-demo'), inquiryId: 'inquiry-demo', status: '待选择' },
  { ...scope('service-request-logistics', 'org-enterprise-ningbo'), inquiryId: 'inquiry-logistics', status: '匹配中' },
  { ...scope('service-request-compliance', 'org-enterprise-ningbo'), inquiryId: 'inquiry-compliance', status: '待选择' },
];
const logisticsQuotes: LogisticsQuote[] = [{ ...scope('logistics-quote-demo'), inquiryId: 'inquiry-demo', amount: 1200, status: '待选择' }, { ...scope('logistics-quote-ningbo', 'org-enterprise-ningbo'), inquiryId: 'inquiry-logistics', amount: 8600, status: '处理中' }];
const quotations: Quotation[] = [{ ...scope('quotation-demo'), inquiryId: 'inquiry-demo', currentVersion: 1, amount: 12000, combination: ['海运', '基础保险'], status: '已发送' }];
const quotationVersions: QuotationVersion[] = [{ ...scope('quotation-version-1'), quotationId: 'quotation-demo', version: 1, amount: 12000, combination: ['海运', '基础保险'], status: '已生效' }];
const quotationFeedbacks: QuotationFeedback[] = [];

const complianceCases: ComplianceCase[] = [{ ...scope('case-demo'), subjectType: 'Product', subjectId: 'product-demo', scope: '境外', status: '待整改' }, { ...scope('case-stall'), subjectType: 'Product', subjectId: 'product-stall-rack', scope: '境外', status: '待整改' }];
const risks: RiskItem[] = [{ ...scope('risk-demo'), caseId: 'case-demo', title: '缺少材质证明', status: '已确认' }, { ...scope('risk-stall'), caseId: 'case-stall', title: '缺少 CE 认证文件', status: '已确认' }];
const rectificationTasks: RectificationTask[] = [{ ...scope('rectification-demo'), riskId: 'risk-demo', ownerId: 'user-provider', status: '待处理' }, { ...scope('rectification-stall'), riskId: 'risk-stall', ownerId: 'user-provider', status: '处理中' }];
const complianceMaterials: ComplianceMaterial[] = [{ ...scope('material-demo'), caseId: 'case-demo', fileAssetId: 'file-compliance', status: '已提交' }, { ...scope('material-stall'), caseId: 'case-stall', fileAssetId: 'file-compliance', status: '待上传' }];
const reviewRecords: ReviewRecord[] = [{ ...scope('review-demo'), caseId: 'case-demo', reviewerId: 'user-enterprise-owner', status: '待复核' }];

const orders: Order[] = [{ ...scope('order-demo'), customerId: 'party-buyer', status: '执行中' }, { ...scope('order-ningbo', 'org-enterprise-ningbo'), customerId: 'party-enterprise-ningbo', status: '已确认' }];
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
  { ...scope('scene-stall-content'), sceneType: 'product-content', initiatedBy: 'user-stall-owner', targetObject: { type: 'Product', id: 'product-stall-lamp' }, status: '待确认', sourceEndpoint: 'H5' },
];
const candidates: CandidateResult[] = [
  { ...scope('candidate-product-description'), sceneRunId: 'scene-product-demo', targetObject: { type: 'Product', id: 'product-demo' }, sourceVersion: 1, candidateVersion: 1, payload: { description: 'Industrial storage rack for global warehouses.' }, sourcePayload: { description: 'Industrial storage rack for global warehouses.' }, fieldMapping: { description: 'description' }, status: '待确认', idempotencyKey: 'candidate-product-description' },
  { ...scope('candidate-stale-product'), sceneRunId: 'scene-product-demo', targetObject: { type: 'Product', id: 'product-demo' }, sourceVersion: 0, candidateVersion: 1, payload: { description: 'Stale description' }, sourcePayload: { description: 'Stale description' }, fieldMapping: { description: 'description' }, status: '待确认', idempotencyKey: 'candidate-stale-product' },
  { ...scope('candidate-lead-profile'), sceneRunId: 'scene-lead-profile', targetObject: { type: 'Lead', id: 'lead-demo' }, sourceVersion: 1, candidateVersion: 1, payload: { name: 'Global Warehouse Buyer / confirmed' }, sourcePayload: { name: 'Global Warehouse Buyer / confirmed' }, fieldMapping: { name: 'name' }, status: '待确认', idempotencyKey: 'candidate-lead-profile' },
  { ...scope('candidate-stall-description'), sceneRunId: 'scene-stall-content', targetObject: { type: 'Product', id: 'product-stall-lamp' }, sourceVersion: 1, candidateVersion: 1, payload: { description: 'Solar garden lamp, 6-piece set, IP65 waterproof, auto on at dusk.' }, sourcePayload: { description: 'Solar garden lamp, 6-piece set, IP65 waterproof, auto on at dusk.' }, fieldMapping: { description: 'description' }, status: '待确认', idempotencyKey: 'candidate-stall-description' },
];
const tasks: Task[] = [
  { ...scope('task-product-confirm'), title: '确认商品候选描述', kind: 'confirmation', objectType: 'Product', objectId: 'product-demo', assigneeId: 'user-enterprise-owner', status: '待确认' },
  { ...scope('task-owner-only'), title: '仅负责人可完成', kind: 'confirmation', objectType: 'Product', objectId: 'product-demo', assigneeId: 'user-enterprise-owner', status: '待处理' },
  { ...scope('task-provider-risk'), title: '补充合规材料', kind: 'risk_review', objectType: 'ComplianceCase', objectId: 'case-demo', assigneeId: 'user-provider', status: '待处理' },
  { ...scope('task-stall-confirm'), title: '确认商品内容候选', kind: 'confirmation', objectType: 'Product', objectId: 'product-stall-lamp', assigneeId: 'user-stall-owner', status: '待确认' },
];
const notifications: Notification[] = [
  { ...scope('notification-risk'), recipientId: 'user-enterprise-owner', title: '商品存在待整改风险', status: '已发送', idempotencyKey: 'risk-demo-notice' },
  { ...scope('notification-quotation-sent'), recipientId: 'user-buyer', title: '您的报价单已发送，请查看确认', status: '已发送', idempotencyKey: 'quotation-sent-notice' },
  { ...scope('notification-inquiry-accepted'), recipientId: 'user-buyer', title: '您的询价需求已受理，处理中', status: '已发送', idempotencyKey: 'inquiry-accepted-notice' },
  { ...scope('notification-stall-risk'), recipientId: 'user-stall-owner', title: '商品「镀锌仓储货架」存在待整改风险', status: '已发送', idempotencyKey: 'stall-risk-notice' },
  { ...scope('notification-stall-confirm'), recipientId: 'user-stall-owner', title: '「太阳能庭院灯」有一份内容候选等待确认', status: '已发送', idempotencyKey: 'stall-confirm-notice' },
];
const versionRecords: VersionRecord[] = [{ ...scope('version-record-product-1'), objectType: 'Product', objectId: 'product-demo', version: 1, status: '正式' }];
const auditLogs: AuditLog[] = [{ ...scope('audit-product-created'), actorId: 'user-product-operator', action: 'product.created', objectType: 'Product', objectId: 'product-demo', status: '已记录', after: { status: '草稿' } }];

const empty = <T>(): T[] => [];
const reports: Report[] = empty();
const dataTasks: DataTask[] = empty();
const ruleConfigurations: RuleConfiguration[] = [{ ...scope('rule-config-demo'), name: '境外商品合规规则', version: '2026.08', status: '已生效' }];
const integrations: IntegrationRecord[] = empty();

const platformListings: PlatformListing[] = [
  { ...scope('listing-amz-rack'), productId: 'product-rack-pro', platform: '亚马逊', title: 'Heavy Duty Steel Pallet Rack 3-Tier 2.5m', keywords: ['storage rack', 'pallet rack', 'warehouse shelf'], price: 188, status: '已上架' },
  { ...scope('listing-tt-rack'), productId: 'product-rack-pro', platform: 'TikTok', title: '重型仓储货架 家用收纳神器', keywords: ['仓储货架', '收纳'], price: 158, status: '已上架' },
  { ...scope('listing-web-lamp'), productId: 'product-lamp-led', platform: '独立站', title: 'LED Motion Sensor Wall Lamp', keywords: ['led lamp', 'motion sensor'], price: 19.9, status: '已上架' },
  { ...scope('listing-amz-basket'), productId: 'product-basket-rattan', platform: '亚马逊', title: 'Rattan Storage Basket Set of 3', keywords: ['storage basket', 'rattan', 'woven'], price: 42, status: '草稿' },
  { ...scope('listing-tt-tool'), productId: 'product-tool-set', platform: 'TikTok', title: '45 件家用工具套装 直播间爆款', keywords: ['工具套装', '工具箱'], price: 129, status: '已上架' },
];
const productCandidates: ProductCandidate[] = [
  { ...scope('cand-cat-litter'), name: '智能猫砂盆', category: '宠物用品', opportunityScore: 92, trend: 'TikTok 宠物类目热度上升 38%', reason: '客单价高、内容展示性强、复购稳定', status: '待评估' },
  { ...scope('cand-camping'), name: '户外折叠露营桌', category: '户外运动', opportunityScore: 85, trend: '亚马逊露营旺季搜索上涨', reason: '轻量易运输、利润空间大', status: '待评估' },
  { ...scope('cand-airfryer'), name: '小型空气炸锅', category: '厨房电器', opportunityScore: 78, trend: '独立站小家电需求稳定', reason: '差异化容量切入', status: '待评估' },
  { ...scope('cand-tumbler'), name: '保温杯（定制印花）', category: '家居日用', opportunityScore: 74, trend: '批量定制需求增长', reason: '可定制化、复购高', status: '待评估' },
];
const sourceOffers: SourceOffer[] = [
  { ...scope('src-rack'), productName: '镀锌仓储货架', supplier: '永康五金工厂', price: 96, moq: 50, rating: 4.8, status: '可用' },
  { ...scope('src-basket'), productName: '藤编收纳篮三件套', supplier: '安吉竹木工厂', price: 32, moq: 100, rating: 4.6, status: '可用' },
  { ...scope('src-lamp'), productName: 'LED 感应壁灯', supplier: '中山灯饰供应链', price: 21, moq: 200, rating: 4.5, status: '可用' },
  { ...scope('src-tool'), productName: '45 件工具套装', supplier: '义乌工具批发', price: 58, moq: 80, rating: 4.7, status: '可用' },
];
const productCerts: ProductCert[] = [
  { ...scope('cert-rack-ce'), productId: 'product-rack-pro', certType: 'CE', status: '有效', expireAt: '2027-06-01' },
  { ...scope('cert-lamp-fcc'), productId: 'product-lamp-led', certType: 'FCC', status: '即将到期', expireAt: '2026-10-01' },
  { ...scope('cert-basket-cpc'), productId: 'product-basket-rattan', certType: 'CPC', status: '缺失', expireAt: '-' },
  { ...scope('cert-tool-rohs'), productId: 'product-tool-set', certType: 'RoHS', status: '有效', expireAt: '2028-01-01' },
];

const allDomains = ['市场判断与选品', '商品建档与内容经营', '营销内容与社媒经营', '获客与客户经营', '询价与报价', '服务与物流', '订单与供应链', '库存与入库', '经营分析与报告', '合规处理'];
const platformProjects: PlatformProject[] = [
  { ...scope('project-wenzhou', 'org-platform', 'project-wenzhou'), name: '温州外贸综合服务项目', region: '温州', modes: ['1039', '9710'], enabledDomains: allDomains, status: '启用' },
  { ...scope('project-nanjing', 'org-platform', 'project-nanjing'), name: '南京合规出海项目', region: '南京', modes: ['9810', '9710'], enabledDomains: ['合规处理', '服务与物流', '经营分析与报告'], status: '启用' },
];

export const demoState: DomainState = {
  organizations, users, roles, projectMemberships, partyCompanies, contacts, customerRelations, supplierRelations, providerRelations,
  products, skus, productAttributes, productAssets, productVersions, channelListings, leads, customerProfiles, touchTasks, followUps, opportunities,
  inquiries, matchResults, serviceRequests, logisticsQuotes, quotations, quotationVersions, quotationFeedbacks, complianceCases, risks, rectificationTasks, complianceMaterials,
  reviewRecords, orders, fulfillments, fulfillmentNodes, riskEvents, inventories, inboundRecords, reports, dataTasks, ruleConfigurations, platformProjects,
  platformListings, productCandidates, sourceOffers, productCerts,
  sceneRuns, candidates, tasks, notifications, files, versionRecords, auditLogs, integrations,
};

export function createInitialState(): DomainState {
  return structuredClone(demoState);
}
