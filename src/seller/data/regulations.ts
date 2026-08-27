// 法规知识库：跨境卖家合规参考数据（静态只读，非业务对象）
// 覆盖多站点 × 多类目的认证、标签、包装环保、平台要求；HS 编码映射；境内/境外合规问答。

export type ComplianceSite = '亚马逊美国' | '亚马逊欧洲' | 'TikTok' | '独立站';

export const COMPLIANCE_SITES: ComplianceSite[] = ['亚马逊美国', '亚马逊欧洲', 'TikTok', '独立站'];

export const COMPLIANCE_CATEGORIES = ['灯具照明', '电子电器', '厨房电器', '厨房餐厨（食品接触）', '玩具', '儿童用品', '纺织品家纺', '个护健康', '宠物用品', '户外运动', '五金工具', '家居收纳', '仓储设备'] as const;

export interface Certification { name: string; region: string; scope: string; label: string; validity: string; mandatory: boolean; }
export interface CompliancePack { certs: Certification[]; labels: string[]; packaging: string[]; platform: string[]; }

// 各认证体系的通用说明（供诊断与问答引用）
export const CERT_DETAILS: Record<string, { region: string; scope: string; label: string; validity: string }> = {
  'CE': { region: '欧盟', scope: '电子、机械、玩具、灯具、家电等强制安全认证；需 CE 标志、符合性声明（DoC）、技术文件，并指定欧盟授权代表（欧代）', label: 'CE 标志', validity: '持续符合，无固定有效期' },
  'FCC': { region: '美国', scope: '电子设备电磁兼容（SDoC 或认证）；无线产品需 FCC ID', label: 'FCC 标签 / FCC ID', validity: '持续符合' },
  'UL / ETL': { region: '美国', scope: '产品安全认证（自愿，但亚马逊等渠道与保险常要求）', label: 'UL 标志 / ETL 标志', validity: '认证后按标准维护' },
  'CPSIA / CPC': { region: '美国', scope: '儿童产品必须符合 CPSIA 并提供儿童产品证书（CPC），含铅、邻苯限量', label: 'CPC 证书', validity: '每次生产批次需匹配' },
  'ASTM F963': { region: '美国', scope: '玩具安全标准，常与 CPSIA/CPC 一并要求', label: '测试报告', validity: '按版本更新' },
  'EN 71': { region: '欧盟', scope: '玩具安全标准，配合 CE 使用', label: 'CE + 测试报告', validity: '按版本更新' },
  'FDA 食品接触': { region: '美国', scope: '与食品接触的材料（厨具、餐盒）需符合 FDA 21 CFR', label: 'FDA 符合声明', validity: '持续符合' },
  'LFGB': { region: '德国', scope: '德国食品接触材料法规，比欧盟 1935/2004 更严格，德国渠道常要求', label: 'LFGB 测试报告', validity: '持续符合' },
  'EU 1935/2004': { region: '欧盟', scope: '食品接触材料框架法规', label: '符合性声明', validity: '持续符合' },
  'REACH': { region: '欧盟', scope: '化学品注册、评估、授权与限制法规；高关注物质（SVHC）需披露', label: 'SVHC 检测/声明', validity: '按 SVHC 清单更新' },
  'RoHS': { region: '欧盟', scope: '电子电气有害物质限制（铅、镉、汞等）', label: 'RoHS 检测报告', validity: '按指令版本' },
  'UKCA': { region: '英国', scope: '英国市场安全认证（北爱另有安排），电子、玩具、机械等强制', label: 'UKCA 标志', validity: '持续符合' },
  'PSE': { region: '日本', scope: '日本电气用品安全法，A 类（菱形）与 B 类（圆形）', label: 'PSE 标志', validity: '持续符合' },
  'KC': { region: '韩国', scope: '韩国电子电气安全认证', label: 'KC 标志', validity: '持续符合' },
  '能效标签': { region: '欧盟', scope: '灯具、家电等需能效等级标签（A-G）并在欧盟能效产品数据库（EPREL）注册', label: '能效标签', validity: '按能效法规更新' },
  'WEEE 注册': { region: '欧盟', scope: '电子电气废弃物回收注册（德国 EAR、法国等），需提供回收计划', label: 'WEEE 注册号', validity: '每年更新' },
  '欧盟电池法规': { region: '欧盟', scope: '2023/1542 新电池法规，含电池产品需注册、电池护照、碳足迹（分阶段）', label: '电池注册号', validity: '按阶段实施' },
  'UN38.3': { region: '国际', scope: '锂电池运输鉴定，空运海运强制', label: '运输鉴定报告', validity: '每批次/每年' },
  '加州 Prop 65': { region: '美国加州', scope: '含铅等有害物质的产品需警告标签', label: 'Prop 65 警告', validity: '持续符合' },
  'FDA 化妆品': { region: '美国', scope: '化妆品符合 FDA 法规（2024 MoCRA 注册），成分安全与标签', label: '成分表/注册', validity: '按法规更新' },
  'EU 化妆品法规': { region: '欧盟', scope: 'EC 1223/2009，上市前需在 CPNP 通报，禁用/限用成分', label: 'CPNP 通报号', validity: '按成分变更更新' },
  '纺织品标签': { region: '美国', scope: '纤维成分、原产地、洗涤护理标签（纺织品标签法）', label: '缝制标签', validity: '持续符合' },
  '阻燃测试': { region: '美国', scope: '床垫、儿童睡衣等需联邦阻燃标准（16 CFR）', label: '测试报告', validity: '按标准' },
};

const pack = (site: ComplianceSite, certKeys: string[], labels: string[], packaging: string[], platform: string[]): CompliancePack => ({
  certs: certKeys.map((key) => ({ name: key, ...CERT_DETAILS[key], mandatory: true })),
  labels, packaging, platform,
});

// 站点 × 类目 → 合规清单
export const COMPLIANCE_MATRIX: Record<ComplianceSite, Record<string, CompliancePack>> = {
  '亚马逊美国': {
    '灯具照明': pack('亚马逊美国', ['FCC', 'UL / ETL', '加州 Prop 65'], ['FCC 标签', '加州 Prop 65 警告（如适用）', '瓦数/流明标识'], ['电池（如含）需 UN38.3 运输鉴定'], ['危险品审核（含锂电池）', '受限商品审核', 'UPC / EAN 条码']),
    '电子电器': pack('亚马逊美国', ['FCC', 'UL / ETL'], ['FCC 标签', '安全警告标识'], ['电池需 UN38.3'], ['危险品审核', 'UPC / EAN']),
    '厨房电器': pack('亚马逊美国', ['UL / ETL', 'FCC', '加州 Prop 65'], ['安全标签', 'Prop 65 警告'], ['UN38.3（含电池）'], ['危险品审核', 'UPC / EAN']),
    '厨房餐厨（食品接触）': pack('亚马逊美国', ['FDA 食品接触', '加州 Prop 65'], ['FDA 符合声明', '材质标识'], [], ['受限商品审核（食品接触类）']),
    '玩具': pack('亚马逊美国', ['CPSIA / CPC', 'ASTM F963'], ['CPC 证书', '警告标签（年龄/窒息）'], ['铅与邻苯测试报告'], ['玩具类目审核（需 CPC）']),
    '儿童用品': pack('亚马逊美国', ['CPSIA / CPC', 'ASTM F963'], ['CPC 证书', '警示标签'], ['铅与邻苯测试'], ['儿童用品类目审核']),
    '纺织品家纺': pack('亚马逊美国', ['纺织品标签', '阻燃测试（床垫/睡衣）'], ['缝制成分/洗涤/原产地标签'], [], ['受限商品审核']),
    '个护健康': pack('亚马逊美国', ['FDA 化妆品'], ['成分表', '用途声明合规'], [], ['个护类目审核（禁医疗宣称）']),
    '宠物用品': pack('亚马逊美国', ['FDA 食品接触（喂食器）'], ['材质标识'], [], ['宠物用品类目（食品类需审核）']),
    '户外运动': pack('亚马逊美国', ['CPSIA / CPC（儿童用）'], ['安全标签'], [], ['类目审核']),
    '五金工具': pack('亚马逊美国', ['加州 Prop 65'], ['Prop 65 警告（如适用）'], [], []),
    '家居收纳': pack('亚马逊美国', ['加州 Prop 65'], ['Prop 65 警告（如适用）'], [], []),
    '仓储设备': pack('亚马逊美国', [] as string[], ['承重/安全说明'], [], []),
  },
  '亚马逊欧洲': {
    '灯具照明': pack('亚马逊欧洲', ['CE', 'RoHS', 'REACH', '能效标签', 'WEEE 注册', '欧盟电池法规（含电池）'], ['CE 标志', '能效标签', 'WEEE 回收标识'], ['包装法注册（德国 LUCID、法国等）', '产品需欧代（EU Responsible Person）'], ['欧洲站 EPR 合规（包装/EEE/电池）', 'CE 责任人/欧代信息', 'VAT 税务合规']),
    '电子电器': pack('亚马逊欧洲', ['CE', 'RoHS', 'REACH', 'WEEE 注册', '欧盟电池法规（含电池）'], ['CE 标志', 'WEEE 标识'], ['包装法注册', '欧代'], ['EPR 合规', '欧代信息', 'VAT']),
    '厨房电器': pack('亚马逊欧洲', ['CE', 'RoHS', 'REACH', '能效标签', 'WEEE 注册', '欧盟电池法规（含电池）'], ['CE 标志', '能效标签'], ['包装法注册', '欧代'], ['EPR 合规', 'VAT']),
    '厨房餐厨（食品接触）': pack('亚马逊欧洲', ['EU 1935/2004', 'LFGB（德国站）', 'REACH'], ['食品接触标识', '材质标识'], ['欧代（如要求）'], ['食品接触类目审核']),
    '玩具': pack('亚马逊欧洲', ['CE', 'EN 71', 'REACH'], ['CE 标志', '年龄/警告标签'], ['EN 71 测试报告', '欧代'], ['玩具类目审核', 'CE 文件']),
    '儿童用品': pack('亚马逊欧洲', ['CE（适用时）', 'EN 71（玩具类）', 'REACH'], ['警示标签'], ['测试报告'], ['类目审核']),
    '纺织品家纺': pack('亚马逊欧洲', ['REACH', '纺织品标签（欧盟法规 1007/2011）'], ['纤维成分标签', '洗涤标签', '原产地'], ['包装法注册'], ['EPR 合规']),
    '个护健康': pack('亚马逊欧洲', ['EU 化妆品法规'], ['成分表（INCI）', 'CPNP 通报'], [], ['化妆品类目审核']),
    '宠物用品': pack('亚马逊欧洲', ['REACH', 'FDA 食品接触（喂食器，如适用）'], ['材质标识'], [], ['类目审核']),
    '户外运动': pack('亚马逊欧洲', ['CE（含电子件）', 'REACH'], ['安全标签'], [], ['类目审核']),
    '五金工具': pack('亚马逊欧洲', ['CE（电动工具）', 'REACH'], ['CE 标志（电动）'], [], []),
    '家居收纳': pack('亚马逊欧洲', ['REACH'], [], ['包装法注册'], ['EPR 合规']),
    '仓储设备': pack('亚马逊欧洲', ['REACH'], ['承重/安全说明'], [], []),
  },
  'TikTok': {
    '灯具照明': pack('TikTok', ['CE（欧洲站）', 'UKCA（英国站）', 'FCC（美国站）'], ['相应认证标志'], ['电池需 UN38.3'], ['TikTok Shop 类目准入', '跨境物流合规', '平台禁售/限售检查']),
    '电子电器': pack('TikTok', ['CE', 'UKCA', 'FCC'], ['认证标志'], ['UN38.3（含电池）'], ['类目准入', '电池产品专项审核']),
    '厨房电器': pack('TikTok', ['CE', 'UKCA', 'FCC'], ['认证标志'], ['UN38.3'], ['类目准入']),
    '厨房餐厨（食品接触）': pack('TikTok', ['FDA 食品接触（美国站）', 'LFGB（欧洲站）'], ['材质标识'], [], ['食品接触类审核']),
    '玩具': pack('TikTok', ['CPC / ASTM（美国站）', 'CE / EN 71（欧洲站）'], ['CPC 证书', '年龄标签'], ['测试报告'], ['玩具类目准入（需证书）']),
    '儿童用品': pack('TikTok', ['CPSIA / CPC（美国站）', 'EN 71（玩具类）'], ['警示标签'], [], ['类目准入']),
    '纺织品家纺': pack('TikTok', ['纺织品标签'], ['成分/洗涤/原产地标签'], [], ['类目准入']),
    '个护健康': pack('TikTok', ['FDA 化妆品（美国站）', 'EU 化妆品法规（欧洲站）'], ['成分表'], [], ['个护类目准入（禁医疗宣称）']),
    '宠物用品': pack('TikTok', ['FDA 食品接触（喂食器）'], ['材质标识'], [], ['类目准入']),
    '户外运动': pack('TikTok', ['CPC（儿童用）'], ['安全标签'], [], ['类目准入']),
    '五金工具': pack('TikTok', ['CE（电动）'], ['CE 标志'], [], ['类目准入']),
    '家居收纳': pack('TikTok', [] as string[], [], [], ['类目准入']),
    '仓储设备': pack('TikTok', [] as string[], ['承重说明'], [], ['类目准入']),
  },
  '独立站': {
    '灯具照明': pack('独立站', ['CE / UKCA（欧洲）', 'FCC（美国）', 'UL / ETL（美国，建议）'], ['认证标志', '安全标识'], ['UN38.3（含电池）', '电池运输合规'], ['税务合规（美国销售税 / 欧洲 VAT）', '支付合规（PCI）', '物流追踪与退换政策']),
    '电子电器': pack('独立站', ['CE / UKCA', 'FCC', 'UL / ETL（建议）'], ['认证标志'], ['UN38.3'], ['税务合规', '物流合规']),
    '厨房电器': pack('独立站', ['CE / UKCA', 'FCC', 'UL / ETL（建议）'], ['认证标志'], ['UN38.3'], ['税务合规']),
    '厨房餐厨（食品接触）': pack('独立站', ['FDA 食品接触（美国）', 'EU 1935/2004（欧洲）'], ['材质标识'], [], ['税务合规']),
    '玩具': pack('独立站', ['CPC / ASTM（美国）', 'CE / EN 71（欧洲）'], ['CPC 证书', '年龄标签'], ['测试报告'], ['税务合规']),
    '儿童用品': pack('独立站', ['CPSIA / CPC（美国）'], ['警示标签'], [], ['税务合规']),
    '纺织品家纺': pack('独立站', ['纺织品标签'], ['成分/洗涤/原产地标签'], [], ['税务合规']),
    '个护健康': pack('独立站', ['FDA 化妆品（美国）', 'EU 化妆品法规（欧洲）'], ['成分表'], [], ['税务合规']),
    '宠物用品': pack('独立站', ['FDA 食品接触（喂食器）'], ['材质标识'], [], ['税务合规']),
    '户外运动': pack('独立站', ['CPC（儿童用）'], ['安全标签'], [], ['税务合规']),
    '五金工具': pack('独立站', ['CE（电动）'], ['CE 标志'], [], ['税务合规']),
    '家居收纳': pack('独立站', [] as string[], [], [], ['税务合规']),
    '仓储设备': pack('独立站', [] as string[], ['承重说明'], [], ['税务合规']),
  },
};

// 商品类目 → HS 编码建议（前 8 位示意）
export const HS_MAP: Record<string, { code: string; name: string; note: string }> = {
  '灯具照明': { code: '9405.4290', name: '其他电灯及照明装置', note: 'LED 灯具多归 9405；含电源线/适配器需注意 8504（变压器）归类。' },
  '电子电器': { code: '8517.6200', name: '接收/转换/传输设备', note: '按具体设备归类；含电池需注意 8507。' },
  '厨房电器': { code: '8516.6000', name: '电热烹饪器具', note: '空气炸锅、烤箱多归 8516；进口欧盟需 CE+能效。' },
  '厨房餐厨（食品接触）': { code: '7323.9300', name: '餐桌厨房家用钢铁器具', note: '不锈钢厨具多归 7323；塑料类归 3924。' },
  '玩具': { code: '9503.0069', name: '其他玩具', note: '电动玩具注意电池归类；木质玩具可能归 4420/9503。' },
  '儿童用品': { code: '9503.0049', name: '儿童用品', note: '按具体品类细分归类。' },
  '纺织品家纺': { code: '6302.3100', name: '床上用品', note: '四件套多归 6302；化纤/棉比例影响细分。' },
  '个护健康': { code: '3304.9900', name: '美容或化妆用品', note: '化妆品归 33 章；需成分与通报合规。' },
  '宠物用品': { code: '4201.0000', name: '宠物用品', note: '宠物用品多归 4201；喂食器等含塑料归 3924。' },
  '户外运动': { code: '6306.2200', name: '帐篷类户外用品', note: '户外装备分散归类，按材质与功能细分。' },
  '五金工具': { code: '8205.5100', name: '家用工具', note: '手动工具多归 82 章；电动工具归 8467。' },
  '家居收纳': { code: '3924.9090', name: '其他塑料家用器具', note: '塑料收纳归 3924；编织类可能归 4602。' },
  '仓储设备': { code: '7308.9000', name: '钢铁结构体', note: '货架多归 7308；注意钢材关税与反倾销。' },
};

// 境内/境外合规问答知识库
export interface QaEntry { question: string; keywords: string[]; answer: string; }
export const COMPLIANCE_QA: Record<'境内' | '境外', QaEntry[]> = {
  境内: [
    { question: '出口欧盟的电子商品需要什么认证？', keywords: ['欧盟', '电子', 'CE'], answer: '电子商品出口欧盟通常需要：CE 认证（含 RoHS 有害物质、REACH 化学品合规）、WEEE 电子废弃物注册、能效标签（灯具/家电）、并指定欧盟授权代表（欧代）。含电池需符合欧盟新电池法规。' },
    { question: '出口美国的玩具需要什么认证？', keywords: ['美国', '玩具', 'CPC'], answer: '美国玩具需符合 CPSIA（消费品安全改进法案）并提供儿童产品证书（CPC），测试标准为 ASTM F963；含铅、邻苯有明确限量。亚马逊等平台会要求上传 CPC 与测试报告。' },
    { question: '食品接触类商品（厨具、餐盒）怎么合规？', keywords: ['食品接触', '厨具', 'FDA'], answer: '出口美国需符合 FDA 21 CFR 食品接触材料要求；出口欧盟需符合 1935/2004 框架法规，德国站还要求 LFGB 测试。需提供符合性声明或测试报告。' },
    { question: '含锂电池的产品有什么运输要求？', keywords: ['电池', '锂电池', '运输'], answer: '含锂电池产品出口需 UN38.3 运输鉴定报告，空运、海运强制；电池容量与包装符合 IMDG/IATA 规定。电商平台（亚马逊、TikTok）会要求危险品审核。' },
    { question: '欧盟的包装法怎么注册？', keywords: ['包装', 'EPR', '德国'], answer: '欧盟多国实施 EPR（生产者责任延伸）：德国包装法需在 LUCID 注册并申报包装量，法国等也有同类要求。未注册的商品会被平台限制销售（亚马逊欧洲站会要求 EPR 编号）。' },
    { question: '化妆品出口需要哪些合规？', keywords: ['化妆品', 'CPNP'], answer: '出口欧盟化妆品需符合 EC 1223/2009，上市前在 CPNP 系统通报，成分用 INCI 命名，禁用限用成分要核查；出口美国需符合 FDA 法规（2024 MoCRA 起需注册与责任人）。' },
  ],
  境外: [
    { question: '亚马逊欧洲站的合规要求有哪些？', keywords: ['亚马逊', '欧洲', 'EPR'], answer: '亚马逊欧洲站（德/法/意/西等）要求：CE 认证与欧代信息、EPR 合规（包装/EEE/电池注册号）、VAT 税务、危险品审核。缺少 EPR 编号的商品会被下架。' },
    { question: 'TikTok Shop 上架有什么合规要求？', keywords: ['TikTok', '上架'], answer: 'TikTok Shop 需完成类目准入：玩具、个护等类目需上传对应证书（CPC、CE 等）；跨境商品需合规物流与禁售限售检查；含电池产品有专项审核。' },
    { question: '独立站卖到美国要交什么税？', keywords: ['独立站', '美国', '税'], answer: '美国无联邦增值税，但需按州征收销售税（经济关联 nexus 判定），多数州按发货地/收货地规则；欧洲独立站需注册 VAT。建议对接税务服务商自动计算与申报。' },
    { question: '出口英国需要什么认证？', keywords: ['英国', 'UKCA'], answer: '英国（不含北爱）使用 UKCA 标志替代 CE，电子、玩具、机械等品类强制；欧盟 CE 文件不能直接用于英国，需英国本地符合性评估（部分品类可延用 CE 至规定日期）。' },
    { question: '出口日本、韩国的电子电器有什么要求？', keywords: ['日本', '韩国', 'PSE'], answer: '日本需 PSE 认证（电气用品安全法，A/B 类），并加贴 PSE 标志；韩国需 KC 认证（电子电气安全）。两国均要求本地代理商信息。' },
    { question: '独立站的退换货和支付合规？', keywords: ['独立站', '退换货', '支付'], answer: '独立站需明确退换货政策（欧盟 14 天冷静期、美国按州差异）、支付渠道 PCI 合规、GDPR 数据隐私；物流需提供追踪号，否则纠纷率高。' },
  ],
};

export function matchQa(scope: '境内' | '境外', input: string): QaEntry | undefined {
  const both = [...COMPLIANCE_QA[scope], ...COMPLIANCE_QA[scope === '境内' ? '境外' : '境内']];
  const hits = both.map((entry) => ({ entry, score: entry.keywords.filter((k) => input.includes(k)).length })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  return hits[0]?.entry;
}
