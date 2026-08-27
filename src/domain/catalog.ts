import type { CatalogEntry, ObjectType } from './types';

type Source = CatalogEntry['projectSource'];
const wenzhouNames = [
  '爆款机会识别', '品类增长分析', '新兴市场机会识别', '选品决策', '行业趋势报告', '竞品洞察', '经营数据诊断', '动态定价建议',
  '商品标签管理', '商品描述完善', '商品图片与场景素材', '营销内容创作', '海外社媒内容', '评论互动管理', '全球海关数据获客',
  '全球采购商数据获客', '采购商画像构建', '相似客户扩量', '邮件触达', '智能需求解析', '自动生成报价单', '多语言商品与服务搜索', '图文询价与相似商品匹配',
  '询价需求生成与辅助询价', '商品信息完善', '商品采集与多语言信息填充', '信用证录入与风险识别', '综合服务需求识别与服务清单生成',
  '综合服务商组合推荐', '物流询价、比价与报价排序', '物流报价转服务产品', '服务商评级', '供应商评级', '订单全生命周期可视化', '履约风险预警',
  '订单分发', '动态补货与库存协同', '智能入库', '交易风险预警与监测', '月度和季度报告', '数据清洗与补全', '数据分类与标签生成',
] as const;
const nanjingNames = [
  '境内合规智能问答', '境外合规智能问答', '智能入驻识别与路径引导', '企业合规风险诊断', '个性化合规整改路径推荐',
  '合规任务生成与服务商匹配', '商品智能归类与 HS 编码建议', '报关单解析与智能建单', '退税智能配单', '自动调疑及退税风险排查',
  '企业出海报告', '企业出海需求与服务商匹配',
] as const;

function sourceGroupFor(source: Source, index: number): string {
  if (source === '南京项目') return index < 10 ? '合规与出海场景' : '外部系统对接';
  if (source !== '温州项目') return source === '外部对接' ? '外部系统对接' : '通用产品';
  if (index <= 20) return 'AI 工作台原始场景';
  if (index <= 26) return 'B2B 商城及卖家端原始场景';
  if (index <= 31) return '服务市场原始场景';
  if (index <= 37) return '供应链 SCM 原始场景';
  return '数据中台原始场景';
}

const usersByDomain: Record<string, string[]> = {
  '市场判断与选品': ['企业负责人', '商品运营人员', '数据分析人员'],
  '商品建档与内容经营': ['商品运营人员', '企业负责人'],
  '营销内容与社媒经营': ['商品运营人员', '营销运营人员'],
  '获客与客户经营': ['获客人员', '销售人员'],
  '询价与报价': ['销售人员', '商品运营人员'],
  '服务与物流': ['企业负责人', '服务商'],
  '订单与供应链': ['供应链人员', '履约人员'],
  '库存与入库': ['仓储人员', '履约人员'],
  '经营分析与报告': ['企业负责人', '平台运营人员'],
  '合规处理': ['合规人员', '企业负责人', '服务商'],
};

const flowDefaults: Record<string, { domain: string; objects: ObjectType[]; nextAction: string }> = {
  '市场判断与选品': { domain: '市场判断与选品', objects: ['Product', 'Report', 'DataTask'], nextAction: '进入商品经营，确认选品结果' },
  '商品建档与内容经营': { domain: '商品建档与内容经营', objects: ['Product', 'ProductAsset', 'ProductVersion'], nextAction: '完善商品并确认正式版本' },
  '营销内容与社媒经营': { domain: '营销内容与社媒经营', objects: ['Product', 'ProductAsset', 'ChannelListing'], nextAction: '确认内容并创建发布任务' },
  '获客与客户经营': { domain: '获客与客户经营', objects: ['Lead', 'CustomerProfile', 'TouchTask', 'FollowUp'], nextAction: '确认采购商并分配跟进' },
  '询价与报价': { domain: '询价与报价', objects: ['Inquiry', 'MatchResult', 'Quotation', 'QuotationVersion'], nextAction: '确认需求并生成报价版本' },
  '服务与物流': { domain: '服务与物流', objects: ['ServiceRequest', 'LogisticsQuote', 'Task'], nextAction: '选择服务方案并进入报价' },
  '订单与供应链': { domain: '订单与供应链', objects: ['Order', 'Fulfillment', 'FulfillmentNode', 'RiskEvent'], nextAction: '跟踪履约节点并处理风险' },
  '库存与入库': { domain: '库存与入库', objects: ['Inventory', 'InboundRecord', 'Task'], nextAction: '更新库存后继续履约' },
  '经营分析与报告': { domain: '经营分析与报告', objects: ['Report', 'DataTask'], nextAction: '确认报告并沉淀经营结论' },
  '合规处理': { domain: '合规处理', objects: ['ComplianceCase', 'RiskItem', 'RectificationTask', 'ComplianceMaterial', 'ReviewRecord'], nextAction: '处理风险并提交复核' },
};

const domainDefinitions: Record<string, Pick<CatalogEntry, 'purpose' | 'inputs' | 'steps' | 'confirmationPoints' | 'result' | 'writeback' | 'taskEffects' | 'notificationEffects' | 'exceptionRecovery'>> = {
  '市场判断与选品': { purpose: '把市场信号和经营数据转成可执行的选品判断。', inputs: ['目标市场、品类范围与经营数据'], steps: ['选择市场和品类', '查看增长、竞品和价格信号', '比较机会候选', '确认选品判断'], confirmationPoints: ['确认市场依据和机会优先级'], result: '形成带依据的选品机会或经营报告。', writeback: '确认后写回商品机会、报告和分析任务。', taskEffects: ['生成选品确认任务'], notificationEffects: ['向商品负责人发送机会提醒'], exceptionRecovery: ['数据不足时补充筛选条件', '规则不确定时转人工判断'] },
  '商品建档与内容经营': { purpose: '建立可持续维护的商品主档、素材和正式版本。', inputs: ['商品基础信息与素材文件'], steps: ['创建或选择商品', '上传图片、视频和属性', '完善多语言描述', '比较候选内容', '确认商品正式版本'], confirmationPoints: ['确认商品信息、素材和版本变更'], result: '形成可继续经营的商品候选内容和正式版本。', writeback: '确认后写回商品、素材库和商品版本。', taskEffects: ['生成内容确认和发布准备任务'], notificationEffects: ['通知商品负责人确认版本'], exceptionRecovery: ['文件失败可重新上传', '版本冲突时基于最新商品重新确认'] },
  '营销内容与社媒经营': { purpose: '将商品信息转成可发布的营销内容并追踪渠道结果。', inputs: ['商品正式版本、品牌信息与内容主题'], steps: ['选择商品和渠道', '生成营销内容候选', '检查渠道限制', '确认内容', '创建发布任务'], confirmationPoints: ['确认文案、素材和目标渠道'], result: '形成可发布的营销内容和渠道任务。', writeback: '确认后写回素材版本和渠道发布记录。', taskEffects: ['创建渠道发布任务'], notificationEffects: ['通知运营人员发布状态'], exceptionRecovery: ['渠道失败可重试', '素材不合格时替换文件'] },
  '获客与客户经营': { purpose: '发现、确认并持续经营采购商和客户关系。', inputs: ['目标市场与采购商线索'], steps: ['选择目标市场和商品', '筛选并去重线索', '查看采购商画像', '确认入库并分配负责人', '触达和记录跟进'], confirmationPoints: ['确认采购商身份、来源和跟进负责人'], result: '形成客户档案、触达记录和可跟进线索。', writeback: '确认后写回线索、客户画像和客户关系。', taskEffects: ['生成分配、触达和跟进任务'], notificationEffects: ['提醒负责人处理新线索和客户反馈'], exceptionRecovery: ['重复线索保留来源并合并', '触达失败可重试'] },
  '询价与报价': { purpose: '把客户询价转成可比较、可确认的报价方案。', inputs: ['客户询价需求、商品条件与交付要求'], steps: ['解析并确认需求', '匹配商品和服务', '比较物流方案', '组合报价方案', '确认并发送报价'], confirmationPoints: ['确认需求、价格、交付条件和报价版本'], result: '形成报价版本并承接客户反馈。', writeback: '确认后写回询价、匹配结果、报价单和报价版本。', taskEffects: ['生成报价确认和客户跟进任务'], notificationEffects: ['通知销售人员客户反馈'], exceptionRecovery: ['需求不完整时补充材料', '物流方案失败时重新询价'] },
  '服务与物流': { purpose: '识别服务需求并匹配服务商或物流方案。', inputs: ['服务需求、目的地、时效和货物信息'], steps: ['识别服务范围', '匹配服务商', '比较服务和物流报价', '选择方案', '提交承接结果'], confirmationPoints: ['确认服务商、方案、价格和责任边界'], result: '形成已选择的服务或物流方案。', writeback: '确认后写回服务需求、物流报价和交易引用。', taskEffects: ['生成服务商处理任务'], notificationEffects: ['通知服务商和企业负责人'], exceptionRecovery: ['服务商不匹配时重新匹配', '外部报价失败时保留请求并重试'] },
  '订单与供应链': { purpose: '跟踪订单从确认到履约完成的业务节点和异常。', inputs: ['订单、商品、客户和交付要求'], steps: ['确认订单信息', '建立履约节点', '更新备货与运输进度', '识别履约风险', '确认完成结果'], confirmationPoints: ['确认节点证据、风险处理和交付结果'], result: '形成可追踪的订单履约状态。', writeback: '确认后写回订单、履约、风险事件和供应链记录。', taskEffects: ['生成履约和风险处理任务'], notificationEffects: ['向责任人发送节点和异常通知'], exceptionRecovery: ['节点失败可重试', '风险转人工处理后继续履约'] },
  '库存与入库': { purpose: '让入库和库存结果可以支撑订单继续履约。', inputs: ['入库单、SKU 数量与验收结果'], steps: ['接收入库任务', '验收货物', '记录部分或全部入库', '更新可用库存', '回到履约节点'], confirmationPoints: ['确认验收数量和库存变化'], result: '形成已核验的入库记录和库存余额。', writeback: '确认后写回入库记录、库存和补货任务。', taskEffects: ['库存不足时生成补货任务'], notificationEffects: ['通知履约负责人库存变化'], exceptionRecovery: ['数量异常时保留异常记录', '部分入库后继续剩余批次'] },
  '经营分析与报告': { purpose: '把授权业务数据沉淀为可确认、可发布的经营报告。', inputs: ['授权业务对象、统计口径与报告周期'], steps: ['选择对象和周期', '执行数据任务', '查看指标与异常', '确认报告结论', '发布报告'], confirmationPoints: ['确认统计范围、口径和经营结论'], result: '形成可追溯的经营分析报告。', writeback: '确认后写回报告版本和数据任务结果。', taskEffects: ['生成报告确认任务'], notificationEffects: ['通知报告查看人'], exceptionRecovery: ['数据任务部分失败时按条目重试', '口径不确定时待人工确认'] },
  '合规处理': { purpose: '围绕材料、风险、整改和复核完成合规处理闭环。', inputs: ['合规材料与适用范围'], steps: ['创建合规案件', '提交并核验材料', '诊断风险', '执行整改并提交证据', '复核并归档'], confirmationPoints: ['确认风险项、整改证据和复核结论'], result: '形成已通过或可继续整改的合规案件。', writeback: '确认后写回案件、风险项、材料、整改任务和复核记录。', taskEffects: ['生成材料补充、整改和复核任务'], notificationEffects: ['通知企业负责人、合规人员和服务商'], exceptionRecovery: ['材料识别失败可重传', '规则无法判断时转人工复核'] },
};

function domainFor(name: string, source: Source): keyof typeof flowDefaults {
  if (source === '南京项目') return name === '企业出海需求与服务商匹配' ? '服务与物流' : name === '企业出海报告' ? '经营分析与报告' : '合规处理';
  if (name.includes('市场') || name.includes('品类') || name.includes('爆款') || name.includes('选品') || name.includes('趋势') || name.includes('竞品') || name.includes('定价') || name.includes('诊断')) return '市场判断与选品';
  if (name.includes('商品') || name.includes('标签') || name.includes('描述') || name.includes('采集')) return '商品建档与内容经营';
  if (name.includes('营销') || name.includes('社媒') || name.includes('评论')) return '营销内容与社媒经营';
  if (name.includes('获客') || name.includes('采购商') || name.includes('邮件')) return '获客与客户经营';
  if (name.includes('询价') || name.includes('报价') || name.includes('搜索') || name.includes('匹配') || name.includes('需求解析') || name.includes('信用证')) return '询价与报价';
  if (name.includes('服务') || name.includes('物流')) return '服务与物流';
  if (name.includes('库存') || name.includes('入库') || name.includes('补货')) return '库存与入库';
  if (name.includes('订单') || name.includes('履约') || name.includes('供应商') || name.includes('交易风险')) return '订单与供应链';
  return '经营分析与报告';
}

function makeEntry(name: string, source: Source, index: number): CatalogEntry {
  const domain = domainFor(name, source);
  const template = flowDefaults[domain];
  const definition = domainDefinitions[domain];
  const businessName = name === '境内合规智能问答' ? '境内合规处理' : name === '境外合规智能问答' ? '境外合规处理' : name;
  return {
    id: `${source === '温州项目' ? 'wenzhou' : 'nanjing'}-${String(index + 1).padStart(2, '0')}`,
    projectSource: source,
    originalSourceName: name,
    sourceMetadata: { originalLabel: name, sourceGroup: sourceGroupFor(source, index), sourceSystem: source === '温州项目' ? '温州项目原始清单' : '南京项目原始清单', sourceProject: source },
    domain: template.domain,
    userVisibleName: businessName,
    purpose: definition.purpose,
    applicableUsers: usersByDomain[domain],
    applicableProjects: [source],
    relatedObjects: template.objects,
    prerequisites: ['已加入对应企业工作区', '已获得项目场景授权'],
    inputs: definition.inputs,
    steps: definition.steps,
    confirmationPoints: definition.confirmationPoints,
    result: definition.result,
    writeback: definition.writeback,
    taskEffects: definition.taskEffects,
    notificationEffects: definition.notificationEffects,
    exceptionRecovery: definition.exceptionRecovery,
    webEntry: `Web 工作台 / 场景中心 / ${businessName}`,
    miniProgramEntry: `小程序 / 我的工作 / ${businessName}`,
    nextAction: template.nextAction,
  };
}

export const catalogEntries: CatalogEntry[] = [
  ...wenzhouNames.map((name, index) => makeEntry(name, '温州项目', index)),
  ...nanjingNames.map((name, index) => makeEntry(name, '南京项目', index)),
];

export { wenzhouNames, nanjingNames };
