export type ID = string;
export type ISODate = string;

export const CANONICAL_STATUSES = {
  Organization: ['待审核', '启用', '停用'] as const,
  User: ['启用', '停用'] as const,
  Role: ['启用', '停用'] as const,
  ProjectMembership: ['启用', '停用'] as const,
  PartyCompany: ['草稿', '有效', '停用', '合并'] as const,
  Contact: ['草稿', '有效', '停用', '合并'] as const,
  CustomerRelation: ['待确认', '有效', '暂停', '结束'] as const,
  SupplierRelation: ['待确认', '有效', '暂停', '结束'] as const,
  ProviderRelation: ['待确认', '有效', '暂停', '结束'] as const,
  Product: ['草稿', '待完善', '可经营', '需整改', '已停用'] as const,
  SKU: ['草稿', '待确认', '有效', '停用'] as const,
  ProductAttribute: ['草稿', '待确认', '有效', '停用'] as const,
  ProductAsset: ['上传中', '待确认', '已确认', '已驳回', '失效'] as const,
  ProductVersion: ['编辑中', '待确认', '已生效', '已废弃'] as const,
  ChannelListing: ['待发布', '发布中', '已发布', '发布失败', '已下架'] as const,
  Lead: ['待筛选', '处理中', '待确认', '已入库', '已分配', '已触达', '跟进中', '无效', '重复', '暂不跟进'] as const,
  CustomerProfile: ['待生成', '待确认', '有效', '已更新', '失效'] as const,
  TouchTask: ['待执行', '执行中', '已发送', '失败', '已取消'] as const,
  FollowUp: ['待跟进', '跟进中', '已完成', '已取消'] as const,
  Opportunity: ['新建', '跟进中', '报价中', '已赢单', '已输单', '已关闭'] as const,
  Inquiry: ['草稿', '待确认', '处理中', '待补充', '已确认', '已关闭'] as const,
  MatchResult: ['处理中', '待选择', '已选择', '已驳回', '失效'] as const,
  ServiceRequest: ['草稿', '待受理', '匹配中', '待选择', '已承接', '已完成', '已取消'] as const,
  LogisticsQuote: ['待询价', '处理中', '待选择', '已选择', '已过期', '失败'] as const,
  Quotation: ['草稿', '待确认', '已发送', '客户已查看', '议价中', '已接受', '已拒绝', '已过期'] as const,
  QuotationVersion: ['编辑中', '已生效', '已废弃'] as const,
  ComplianceCase: ['待受理', '处理中', '待补充材料', '待整改', '待复核', '已通过', '已归档', '已关闭'] as const,
  RiskItem: ['待确认', '已确认', '整改中', '待复核', '已解除', '已豁免', '已关闭'] as const,
  RectificationTask: ['待处理', '处理中', '待提交', '待复核', '已通过', '已退回', '已取消'] as const,
  ComplianceMaterial: ['待上传', '上传中', '已提交', '识别失败', '待补充', '已确认', '已作废'] as const,
  ReviewRecord: ['待复核', '通过', '退回', '已撤回'] as const,
  Order: ['草稿', '待确认', '待补充信息', '已确认', '执行中', '部分完成', '已完成', '已暂停', '已取消', '履约异常'] as const,
  Fulfillment: ['未开始', '处理中', '部分完成', '已完成', '已暂停', '已取消', '存在风险'] as const,
  FulfillmentNode: ['未开始', '处理中', '待确认', '已完成', '存在风险', '已暂停', '已取消'] as const,
  RiskEvent: ['新建', '处理中', '待复核', '已解除', '已接受', '已关闭'] as const,
  Inventory: ['可用', '预警', '冻结', '盘点中'] as const,
  InboundRecord: ['待入库', '验收中', '部分入库', '已入库', '异常'] as const,
  Report: ['生成中', '待确认', '已发布', '已废弃', '失败'] as const,
  DataTask: ['待处理', '处理中', '部分完成', '已完成', '失败', '已取消'] as const,
  RuleConfiguration: ['草稿', '待发布', '已生效', '已停用', '已过期'] as const,
  SceneRun: ['未开始', '处理中', '待确认', '待补充', '已确认', '已驳回', '失败', '超时', '已取消'] as const,
  CandidateResult: ['生成中', '待确认', '已确认', '已驳回', '已过期', '写回失败'] as const,
  Task: ['待处理', '处理中', '待确认', '待复核', '已完成', '已退回', '已取消', '已超时'] as const,
  Notification: ['待发送', '已发送', '发送失败', '已读', '已失效'] as const,
  FileAsset: ['待上传', '上传中', '已上传', '处理中', '可用', '失败', '已作废'] as const,
  AuditLog: ['已记录', '归档'] as const,
  IntegrationRecord: ['待发送', '处理中', '成功', '部分成功', '失败', '待重试', '已放弃'] as const,
  PlatformListing: ['草稿', '已上架', '已下架'] as const,
  ProductCandidate: ['待评估', '已采纳', '已放弃'] as const,
  SourceOffer: ['可用', '已失效'] as const,
  ProductCert: ['有效', '即将到期', '已过期', '缺失'] as const,
} as const;

export type StatusName = typeof CANONICAL_STATUSES[keyof typeof CANONICAL_STATUSES][number];
export type ProductLifecycleStatus = typeof CANONICAL_STATUSES.Product[number];
export type SceneRunStatus = typeof CANONICAL_STATUSES.SceneRun[number];
export type ProductProgressStatus = '未开始' | '处理中' | '待确认' | '已完成' | '待整改' | '待发布';
export type RoleName = 'enterprise_owner' | 'product_operator' | 'sales_operator' | 'compliance_operator' | 'fulfillment_operator' | 'service_provider' | 'platform_operator' | 'customer';
export type EndpointName = 'Web' | '小程序' | 'H5';
export type OrganizationKind = 'platform' | 'enterprise' | 'provider';
export type ObjectType = keyof typeof CANONICAL_STATUSES;

export interface ScopedRecord {
  id: ID;
  organizationId: ID;
  projectId: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Organization extends ScopedRecord {
  name: string;
  kind: OrganizationKind;
  status: typeof CANONICAL_STATUSES.Organization[number];
}
export interface User extends ScopedRecord { name: string; roleId: ID; status: typeof CANONICAL_STATUSES.User[number]; partyCompanyId?: ID; }
export interface Role extends ScopedRecord { name: string; code: RoleName; status: typeof CANONICAL_STATUSES.Role[number]; }
export interface ProjectMembership extends ScopedRecord { userId: ID; roleId: ID; status: typeof CANONICAL_STATUSES.ProjectMembership[number]; }
export interface PartyCompany extends ScopedRecord { name: string; kind: 'enterprise' | 'customer' | 'supplier' | 'provider'; status: typeof CANONICAL_STATUSES.PartyCompany[number]; }
export interface Contact extends ScopedRecord { partyCompanyId: ID; name: string; email: string; status: typeof CANONICAL_STATUSES.Contact[number]; }
export interface RelationBase extends ScopedRecord { sourceCompanyId: ID; targetCompanyId: ID; }
export interface CustomerRelation extends RelationBase { status: typeof CANONICAL_STATUSES.CustomerRelation[number]; }
export interface SupplierRelation extends RelationBase { status: typeof CANONICAL_STATUSES.SupplierRelation[number]; }
export interface ProviderRelation extends RelationBase { status: typeof CANONICAL_STATUSES.ProviderRelation[number]; }
export interface Product extends ScopedRecord { name: string; description: string; ownerId: ID; status: ProductLifecycleStatus; currentVersion: number; price?: number; unit?: string; category?: string; }
export interface SKU extends ScopedRecord { productId: ID; code: string; status: typeof CANONICAL_STATUSES.SKU[number]; }
export interface ProductAttribute extends ScopedRecord { productId: ID; name: string; value: string; status: typeof CANONICAL_STATUSES.ProductAttribute[number]; }
export interface ProductAsset extends ScopedRecord { productId: ID; kind: 'image' | 'video' | 'document'; fileAssetId: ID; status: typeof CANONICAL_STATUSES.ProductAsset[number]; }
export interface ProductVersion extends ScopedRecord { productId: ID; version: number; description: string; status: typeof CANONICAL_STATUSES.ProductVersion[number]; createdBy: ID; }
export interface ChannelListing extends ScopedRecord { productId: ID; channel: string; status: typeof CANONICAL_STATUSES.ChannelListing[number]; }
export interface Lead extends ScopedRecord { name: string; companyId: ID; ownerId?: ID; version: number; status: typeof CANONICAL_STATUSES.Lead[number]; }
export interface CustomerProfile extends ScopedRecord { companyId: ID; summary: string; status: typeof CANONICAL_STATUSES.CustomerProfile[number]; }
export interface TouchTask extends ScopedRecord { leadId: ID; ownerId: ID; status: typeof CANONICAL_STATUSES.TouchTask[number]; }
export interface FollowUp extends ScopedRecord { leadId: ID; ownerId: ID; status: typeof CANONICAL_STATUSES.FollowUp[number]; }
export interface Opportunity extends ScopedRecord { leadId?: ID; quotationId?: ID; name: string; ownerId: ID; status: typeof CANONICAL_STATUSES.Opportunity[number]; }
export interface Inquiry extends ScopedRecord { customerId: ID; summary: string; status: typeof CANONICAL_STATUSES.Inquiry[number]; images?: string[]; }
export interface MatchResult extends ScopedRecord { inquiryId: ID; selectedObjectId?: ID; status: typeof CANONICAL_STATUSES.MatchResult[number]; }
export interface ServiceRequest extends ScopedRecord { inquiryId: ID; providerId?: ID; status: typeof CANONICAL_STATUSES.ServiceRequest[number]; }
export interface LogisticsQuote extends ScopedRecord { inquiryId: ID; amount: number; status: typeof CANONICAL_STATUSES.LogisticsQuote[number]; }
export interface Quotation extends ScopedRecord { inquiryId: ID; currentVersion: number; amount: number; combination: string[]; status: typeof CANONICAL_STATUSES.Quotation[number]; }
export interface QuotationVersion extends ScopedRecord { quotationId: ID; version: number; amount: number; combination: string[]; status: typeof CANONICAL_STATUSES.QuotationVersion[number]; }
export interface QuotationFeedback extends ScopedRecord { quotationId: ID; feedback: 'viewed' | 'accepted' | 'rejected' | 'negotiating'; }
export interface ComplianceCase extends ScopedRecord { subjectType: 'Product' | 'Order' | 'Organization'; subjectId: ID; scope: '境内' | '境外'; status: typeof CANONICAL_STATUSES.ComplianceCase[number]; }
export interface RiskItem extends ScopedRecord { caseId: ID; title: string; status: typeof CANONICAL_STATUSES.RiskItem[number]; }
export interface RectificationTask extends ScopedRecord { riskId: ID; ownerId: ID; status: typeof CANONICAL_STATUSES.RectificationTask[number]; }
export interface ComplianceMaterial extends ScopedRecord { caseId: ID; fileAssetId: ID; status: typeof CANONICAL_STATUSES.ComplianceMaterial[number]; }
export interface ReviewRecord extends ScopedRecord { caseId: ID; reviewerId: ID; status: typeof CANONICAL_STATUSES.ReviewRecord[number]; }
export interface Order extends ScopedRecord { customerId: ID; status: typeof CANONICAL_STATUSES.Order[number]; }
export interface Fulfillment extends ScopedRecord { orderId: ID; status: typeof CANONICAL_STATUSES.Fulfillment[number]; }
export interface FulfillmentNode extends ScopedRecord { fulfillmentId: ID; name: string; status: typeof CANONICAL_STATUSES.FulfillmentNode[number]; }
export interface RiskEvent extends ScopedRecord { orderId: ID; nodeId: ID; status: typeof CANONICAL_STATUSES.RiskEvent[number]; }
export interface Inventory extends ScopedRecord { skuId: ID; quantity: number; status: typeof CANONICAL_STATUSES.Inventory[number]; }
export interface InboundRecord extends ScopedRecord { orderId: ID; quantity: number; status: typeof CANONICAL_STATUSES.InboundRecord[number]; }
export interface Report extends ScopedRecord { title: string; status: typeof CANONICAL_STATUSES.Report[number]; }
export interface DataTask extends ScopedRecord { name: string; status: typeof CANONICAL_STATUSES.DataTask[number]; }
export interface RuleConfiguration extends ScopedRecord { name: string; version: string; status: typeof CANONICAL_STATUSES.RuleConfiguration[number]; }
export interface PlatformProject extends ScopedRecord { name: string; region: string; modes: string[]; enabledDomains: string[]; status: typeof CANONICAL_STATUSES.Organization[number]; }
export interface SceneRun extends ScopedRecord { sceneType: string; initiatedBy: ID; targetObject: { type: ObjectType; id: ID }; status: SceneRunStatus; sourceEndpoint: EndpointName; }
export interface CandidateResult extends ScopedRecord { sceneRunId: ID; targetObject: { type: ObjectType; id: ID }; sourceVersion: number; candidateVersion: number; payload: Record<string, unknown>; sourcePayload?: Record<string, unknown>; fieldMapping: Record<string, string>; status: typeof CANONICAL_STATUSES.CandidateResult[number]; idempotencyKey: string; confirmedBy?: ID; confirmedAt?: ISODate; }
export type TaskKind = 'confirmation' | 'publish' | 'follow_up' | 'risk_review' | 'rule_review' | 'exception';
export interface Task extends ScopedRecord { title: string; kind: TaskKind; objectType: ObjectType; objectId: ID; assigneeId: ID; status: typeof CANONICAL_STATUSES.Task[number]; idempotencyKey?: string; }
export interface Notification extends ScopedRecord { recipientId: ID; title: string; status: typeof CANONICAL_STATUSES.Notification[number]; idempotencyKey: string; }
export interface FileAsset extends ScopedRecord { name: string; status: typeof CANONICAL_STATUSES.FileAsset[number]; }
export interface VersionRecord extends ScopedRecord { objectType: ObjectType; objectId: ID; version: number; sourceCandidateId?: ID; status: '正式' | '候选'; }
export interface AuditLog extends ScopedRecord { actorId: ID; action: string; objectType: ObjectType | 'Task' | 'SceneRun' | 'PlatformProject'; objectId: ID; status: typeof CANONICAL_STATUSES.AuditLog[number]; before?: unknown; after?: unknown; idempotencyKey?: string; }
export interface IntegrationRecord extends ScopedRecord { provider: string; status: typeof CANONICAL_STATUSES.IntegrationRecord[number]; idempotencyKey: string; responseSummary?: string; }
export type MarketplacePlatform = '亚马逊' | 'TikTok' | '独立站';
export interface PlatformListing extends ScopedRecord { productId: ID; platform: MarketplacePlatform; title: string; keywords: string[]; price: number; description?: string; status: typeof CANONICAL_STATUSES.PlatformListing[number]; }
export interface ProductCandidate extends ScopedRecord { name: string; category: string; opportunityScore: number; trend: string; reason: string; status: typeof CANONICAL_STATUSES.ProductCandidate[number]; }
export interface SourceOffer extends ScopedRecord { productName: string; supplier: string; price: number; moq: number; rating: number; status: typeof CANONICAL_STATUSES.SourceOffer[number]; }
export interface ProductCert extends ScopedRecord { productId: ID; certType: string; status: typeof CANONICAL_STATUSES.ProductCert[number]; expireAt: ISODate; }

export interface CatalogEntry {
  id: ID;
  projectSource: '温州项目' | '南京项目' | '通用产品' | '外部对接';
  originalSourceName: string;
  sourceMetadata: { originalLabel: string; sourceGroup: string; sourceSystem: string; sourceProject: string };
  domain: string;
  userVisibleName: string;
  purpose: string;
  applicableUsers: string[];
  applicableProjects: string[];
  relatedObjects: ObjectType[];
  prerequisites: string[];
  inputs: string[];
  steps: string[];
  confirmationPoints: string[];
  result: string;
  writeback: string;
  taskEffects: string[];
  notificationEffects: string[];
  exceptionRecovery: string[];
  webEntry: string;
  miniProgramEntry: string;
  nextAction: string;
}

export interface Actor { userId: ID; organizationId: ID; projectIds: ID[]; role: RoleName; }
export interface DomainState {
  organizations: Organization[]; users: User[]; roles: Role[]; projectMemberships: ProjectMembership[];
  partyCompanies: PartyCompany[]; contacts: Contact[]; customerRelations: CustomerRelation[]; supplierRelations: SupplierRelation[]; providerRelations: ProviderRelation[];
  products: Product[]; skus: SKU[]; productAttributes: ProductAttribute[]; productAssets: ProductAsset[]; productVersions: ProductVersion[]; channelListings: ChannelListing[];
  leads: Lead[]; customerProfiles: CustomerProfile[]; touchTasks: TouchTask[]; followUps: FollowUp[]; opportunities: Opportunity[];
  inquiries: Inquiry[]; matchResults: MatchResult[]; serviceRequests: ServiceRequest[]; logisticsQuotes: LogisticsQuote[]; quotations: Quotation[]; quotationVersions: QuotationVersion[]; quotationFeedbacks: QuotationFeedback[];
  complianceCases: ComplianceCase[]; risks: RiskItem[]; rectificationTasks: RectificationTask[]; complianceMaterials: ComplianceMaterial[]; reviewRecords: ReviewRecord[];
  orders: Order[]; fulfillments: Fulfillment[]; fulfillmentNodes: FulfillmentNode[]; riskEvents: RiskEvent[]; inventories: Inventory[]; inboundRecords: InboundRecord[];
  reports: Report[]; dataTasks: DataTask[]; ruleConfigurations: RuleConfiguration[]; platformProjects: PlatformProject[];
  platformListings: PlatformListing[]; productCandidates: ProductCandidate[]; sourceOffers: SourceOffer[]; productCerts: ProductCert[];
  sceneRuns: SceneRun[]; candidates: CandidateResult[]; tasks: Task[]; notifications: Notification[]; files: FileAsset[]; versionRecords: VersionRecord[]; auditLogs: AuditLog[]; integrations: IntegrationRecord[];
}

export type DomainAction =
  | { type: 'createProductDraft'; actor: Actor; productId: ID; name: string }
  | { type: 'updateProductDraft'; actor: Actor; productId: ID; fields: Partial<Pick<Product, 'name' | 'description' | 'price' | 'unit' | 'category'>>; idempotencyKey: string }
  | { type: 'uploadProductAsset'; actor: Actor; productId: ID; assetId: ID; fileId: ID; name: string; kind: 'image' | 'video' | 'document'; idempotencyKey: string }
  | { type: 'publishProduct'; actor: Actor; productId: ID; channel?: string; idempotencyKey: string }
  | { type: 'saveListingContent'; actor: Actor; productId: ID; platform: MarketplacePlatform; title: string; keywords: string[]; description?: string; idempotencyKey: string }
  | { type: 'processProductContent'; actor: Actor; productId: ID; sceneRunId: ID; candidateId: ID; payload: Record<string, unknown>; sourceVersion: number; idempotencyKey: string }
  | { type: 'startScene'; actor: Actor; sceneRunId: ID; sceneType: string; targetObject: { type: ObjectType; id: ID }; sourceEndpoint?: 'Web' | '小程序' }
  | { type: 'processingComplete'; actor: Actor; sceneRunId: ID; candidateId: ID; payload: Record<string, unknown>; sourceVersion: number; idempotencyKey: string }
  | { type: 'confirmCandidate'; actor: Actor; candidateId: ID; idempotencyKey: string }
  | { type: 'rejectCandidate'; actor: Actor; candidateId: ID; reason?: string }
  | { type: 'writebackObject'; actor: Actor; candidateId: ID; idempotencyKey: string }
  | { type: 'retryWriteback'; actor: Actor; candidateId: ID; idempotencyKey: string; payload?: Record<string, unknown> }
  | { type: 'assignTask'; actor: Actor; taskId: ID; assigneeId: ID }
  | { type: 'completeTask'; actor: Actor; taskId: ID }
  | { type: 'returnTask'; actor: Actor; taskId: ID; reason: string }
  | { type: 'retryScene'; actor: Actor; sceneRunId: ID; idempotencyKey: string }
  | { type: 'markSceneFailure'; actor: Actor; sceneRunId: ID; failure: 'file' | 'external' | 'timeout' | 'rule_indeterminate'; message: string }
  | { type: 'leadEvent'; actor: Actor; leadId: ID; event: 'confirm' | 'processing_complete' | 'store' | 'assign' | 'touch' | 'follow_up' | 'convert'; idempotencyKey?: string }
  | { type: 'complianceCaseEvent'; actor: Actor; caseId: ID; event: 'accept' | 'request_materials' | 'request_rectification' | 'submit_review' | 'approve' | 'archive'; idempotencyKey?: string }
  | { type: 'complianceMaterialEvent'; actor: Actor; materialId: ID; event: 'start_upload' | 'submit' | 'confirm' | 'request_more' | 'invalidate'; idempotencyKey?: string }
  | { type: 'riskItemEvent'; actor: Actor; riskId: ID; event: 'confirm' | 'start_rectification' | 'submit_review' | 'resolve' | 'waive' | 'close'; idempotencyKey?: string }
  | { type: 'rectificationTaskEvent'; actor: Actor; taskId: ID; event: 'start' | 'submit' | 'review' | 'approve' | 'return' | 'cancel'; idempotencyKey?: string }
  | { type: 'reviewRecordEvent'; actor: Actor; reviewId: ID; event: 'approve' | 'return' | 'withdraw'; idempotencyKey?: string }
  | { type: 'inquiryEvent'; actor: Actor; inquiryId: ID; event: 'process' | 'request_more' | 'confirm' | 'close'; idempotencyKey?: string }
  | { type: 'matchResultEvent'; actor: Actor; matchResultId: ID; event: 'choose' | 'reject' | 'expire'; idempotencyKey?: string }
  | { type: 'quotationEvent'; actor: Actor; quotationId: ID; event: 'confirm' | 'send' | 'expire' | 'close'; idempotencyKey?: string }
  | { type: 'orderEvent'; actor: Actor; orderId: ID; event: 'confirm' | 'start' | 'pause' | 'resume' | 'cancel'; idempotencyKey?: string }
  | { type: 'riskResolve'; actor: Actor; riskId: ID }
  | { type: 'quotationFeedback'; actor: Actor; quotationId: ID; feedback: 'viewed' | 'accepted' | 'rejected' | 'negotiating'; idempotencyKey: string; targetAmount?: number; comment?: string }
  | { type: 'customerSubmitInquiry'; actor: Actor; inquiryId: ID; summary: string; images?: string[]; idempotencyKey: string }
  | { type: 'createQuotationVersion'; actor: Actor; quotationId: ID; amount: number; combination: string[]; idempotencyKey: string }
  | { type: 'reviseQuotation'; actor: Actor; quotationId: ID; amount: number; combination: string[]; idempotencyKey: string }
  | { type: 'fulfillmentNodeEvent'; actor: Actor; nodeId: ID; orderId: ID; event: 'start' | 'submit' | 'confirm' | 'risk' | 'resolve' | 'pause' | 'cancel' | 'complete'; riskEventId?: ID; inboundRecordId?: ID; inventoryId?: ID; idempotencyKey?: string }
  | { type: 'riskEventEvent'; actor: Actor; riskEventId: ID; event: 'start' | 'submit_review' | 'resolve' | 'accept' | 'close'; idempotencyKey?: string }
  | { type: 'inventoryEvent'; actor: Actor; inventoryId: ID; event: 'warn' | 'freeze' | 'start_count' | 'release'; idempotencyKey?: string }
  | { type: 'inboundRecordEvent'; actor: Actor; inboundRecordId: ID; event: 'start_inspection' | 'partial' | 'complete' | 'exception'; idempotencyKey?: string }
  | { type: 'approveEnterpriseAdmission'; actor: Actor; organizationId: ID; idempotencyKey?: string }
  | { type: 'rejectEnterpriseAdmission'; actor: Actor; organizationId: ID; reason?: string; idempotencyKey?: string }
  | { type: 'toggleProjectDomain'; actor: Actor; projectId: ID; domain: string; idempotencyKey?: string }
  | { type: 'assignServiceRequest'; actor: Actor; serviceRequestId: ID; providerId: ID; idempotencyKey?: string }
  | { type: 'resetDemo' };
