// 选品分析知识库：候选商品深度分析 + 关键词分析模板（静态只读）

export interface SupplierInfo { name: string; price: number; moq: number; rating: number; }
export interface ProductAnalysis {
  id: string;
  name: string;
  category: string;
  score: number;            // 机会评分
  heat: number;             // 市场热度 %
  trend: string;            // 趋势
  season: string;           // 季节性
  competition: '低' | '中' | '高';
  concentration: string;    // 头部集中度
  avgReviews: string;       // 头部平均评论
  priceBand: string;        // 建议价格带
  // 利润测算（人民币/单）
  price: number;            // 建议售价
  cost: number;             // 采购成本
  freight: number;          // 头程物流
  commissionRate: number;   // 平台佣金 %
  adRate: number;           // 广告占比 %
  netProfit: number;        // 净利/单
  margin: number;           // 毛利率 %
  risk: '低' | '中' | '高';
  riskNote: string;
  compliance: string[];     // 合规要求（引用法规库）
  budget: string;           // 试款预算建议
  playbook: string;         // 打法建议
  reason: string;           // 选品理由
  suppliers: SupplierInfo[];
}

export const PRODUCT_ANALYSES: ProductAnalysis[] = [
  {
    id: 'cand-cat-litter', name: '智能猫砂盆', category: '宠物用品', score: 92, heat: 86, trend: 'TikTok 宠物类目热度上升 38%', season: '全年平稳，双 11 / 黑五有波峰', competition: '中', concentration: '头部集中度 35%', avgReviews: '头部约 800 条', priceBand: '¥500-900',
    price: 599, cost: 180, freight: 60, commissionRate: 0.15, adRate: 0.15, netProfit: 159, margin: 26,
    risk: '中', riskNote: '含电子件与锂电池，需 CE/FCC 与 UN38.3 运输鉴定；退货率偏高需关注', compliance: ['CE', 'FCC', 'UN38.3（电池）'],
    budget: '首款 3-5 万元，2-3 个变体', playbook: 'TikTok 内容种草（猫砂清理场景）+ 直播带量；亚马逊 SP 广告收搜索流量', reason: '客单价高、内容展示性强、复购稳定，视频种草转化好', suppliers: [{ name: '深圳宠物电器工厂', price: 165, moq: 100, rating: 4.6 }, { name: '义乌宠物用品批发', price: 150, moq: 200, rating: 4.3 }],
  },
  {
    id: 'cand-camping', name: '户外折叠露营桌', category: '户外运动', score: 85, heat: 74, trend: '亚马逊露营旺季搜索上涨', season: '4-9 月为旺季，10 月回落', competition: '低', concentration: '头部集中度 18%', avgReviews: '头部约 300 条', priceBand: '¥120-260',
    price: 199, cost: 62, freight: 28, commissionRate: 0.15, adRate: 0.12, netProfit: 64, margin: 32,
    risk: '低', riskNote: '无强制认证，注意承重与安全说明', compliance: ['承重/安全说明'],
    budget: '首款 2-3 万元', playbook: '亚马逊搜索型打法：旺季前上架，SP 自动广告起量后转手动；捆绑收纳袋做差异化', reason: '轻量易运输、利润空间大、竞争度低，旺季需求明确', suppliers: [{ name: '永康户外工厂', price: 55, moq: 100, rating: 4.8 }, { name: '河北露营装备厂', price: 58, moq: 50, rating: 4.5 }],
  },
  {
    id: 'cand-airfryer', name: '小型空气炸锅', category: '厨房电器', score: 78, heat: 68, trend: '独立站小家电需求稳定', season: '秋冬旺季明显', competition: '高', concentration: '头部集中度 60%', avgReviews: '头部 5000+ 条', priceBand: '¥150-400',
    price: 299, cost: 95, freight: 45, commissionRate: 0.15, adRate: 0.2, netProfit: 43, margin: 22,
    risk: '高', riskNote: '电器类需 CE/UL 认证与能效标签；大件物流成本高、售后风险大', compliance: ['CE', 'UL / ETL', '能效标签', 'WEEE'],
    budget: '建议 8 万元以上', playbook: '差异化容量/颜值切入细分场景；注意认证与售后成本，慎入', reason: '需求稳定但竞争激烈、认证成本高，适合有供应链优势的卖家', suppliers: [{ name: '佛山小家电工厂', price: 88, moq: 200, rating: 4.4 }, { name: '中山电器代工', price: 92, moq: 150, rating: 4.2 }],
  },
  {
    id: 'cand-tumbler', name: '保温杯（定制印花）', category: '家居日用', score: 74, heat: 62, trend: '批量定制需求增长', season: '秋冬旺季，节日礼赠有波峰', competition: '高', concentration: '头部集中度 55%', avgReviews: '头部 2000+ 条', priceBand: '¥40-120',
    price: 79, cost: 22, freight: 12, commissionRate: 0.15, adRate: 0.12, netProfit: 15, margin: 18,
    risk: '低', riskNote: '食品接触需 FDA 声明；印花油墨注意环保要求', compliance: ['FDA 食品接触'],
    budget: '首款 1-2 万元试款', playbook: '以定制/联名做差异化，TikTok 开箱内容；礼品季备货', reason: '可定制化、复购高，但标品竞争激烈，靠差异化取胜', suppliers: [{ name: '永康保温杯厂', price: 19, moq: 200, rating: 4.6 }, { name: '义乌杯壶批发', price: 18, moq: 300, rating: 4.4 }],
  },
  {
    id: 'cand-pet-feeder', name: '宠物自动喂食器', category: '宠物用品', score: 81, heat: 70, trend: 'TikTok 养宠人群渗透上升', season: '全年平稳', competition: '中', concentration: '头部集中度 30%', avgReviews: '头部约 600 条', priceBand: '¥200-450',
    price: 329, cost: 110, freight: 40, commissionRate: 0.15, adRate: 0.15, netProfit: 74, margin: 22,
    risk: '中', riskNote: '电子件 + 电池，需 CE/FCC；食品接触料需 FDA', compliance: ['CE', 'FCC', 'FDA 食品接触（料仓）'],
    budget: '首款 4-6 万元', playbook: 'TikTok 内容（出差场景）种草 + 亚马逊搜索承接；与猫砂盆组合搭配', reason: '宠物刚需场景、内容性强，客单价中等、复购配件', suppliers: [{ name: '深圳宠物电器工厂', price: 98, moq: 100, rating: 4.5 }, { name: '东莞电子代工', price: 102, moq: 150, rating: 4.3 }],
  },
  {
    id: 'cand-camping-lamp', name: '露营氛围灯串', category: '灯具照明', score: 79, heat: 73, trend: '露营内容带动搜索', season: '4-10 月旺季', competition: '中', concentration: '头部集中度 28%', avgReviews: '头部约 400 条', priceBand: '¥60-160',
    price: 119, cost: 28, freight: 18, commissionRate: 0.15, adRate: 0.12, netProfit: 34, margin: 28,
    risk: '中', riskNote: '灯串含电子件需 CE/FCC；电池款需 UN38.3', compliance: ['CE', 'FCC', 'UN38.3（电池款）'],
    budget: '首款 2-3 万元', playbook: 'TikTok 露营场景短视频 + 亚马逊旺季备货；与露营桌组合销售', reason: '场景内容强、毛利高，露营热带动增长', suppliers: [{ name: '中山灯饰供应链', price: 24, moq: 200, rating: 4.5 }, { name: '义乌灯具批发', price: 22, moq: 300, rating: 4.2 }],
  },
];

// 关键词分析：确定性模板（按关键词长度做轻微扰动，避免每次不同）
export interface KeywordAnalysis {
  heat: number; trend: string; season: string; competition: '低' | '中' | '高'; concentration: string; priceBand: string;
  score: number; advice: string;
}
export function analyzeKeyword(keyword: string, site: string): KeywordAnalysis {
  const seed = (keyword + site).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const heat = 55 + (seed % 40);
  const trendIdx = seed % 4;
  const trends = ['上升 12%', '上升 8%', '平稳', '上升 20%'];
  const compIdx = seed % 3;
  const comps = ['中', '低', '高'] as const;
  const seasons = ['秋冬为旺季', '全年平稳，节庆有波峰', '4-9 月旺季明显', '无明显季节性'];
  const comp = comps[compIdx];
  const score = Math.min(95, Math.round(heat * 0.55 + (comp === '低' ? 28 : comp === '中' ? 16 : 4) + (trends[trendIdx] === '上升 20%' ? 8 : 0)));
  return {
    heat, trend: trends[trendIdx], season: seasons[seed % 4], competition: comp,
    concentration: comp === '高' ? '头部集中度 55% 以上' : comp === '中' ? '头部集中度约 35%' : '头部集中度约 18%，分散',
    priceBand: comp === '高' ? '价格带较宽，需差异化' : comp === '中' ? '中端价格带机会明确' : '价格带分散，可切入',
    score,
    advice: `「${keyword}」在 ${site} 市场热度 ${heat}%，趋势${trends[trendIdx]}，竞争${comp}（${comp === '中' ? '头部约 35%' : comp === '高' ? '偏集中' : '分散'}）。建议首款预算 ${score >= 85 ? '3-5 万元' : score >= 75 ? '2-3 万元' : '1-2 万元'} 试款，优先做差异化卖点与短视频内容；上架前先查该品类合规要求（可在「合规助手」查询）。`,
  };
}
