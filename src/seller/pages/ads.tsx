import { useState } from 'react';
import { useDomainStore } from '../../domain/store';
import { useToast } from '../../h5/components';
import type { MarketplacePlatform } from '../../domain/types';

const GOALS = [['launch', '新品推爆'], ['stable', '稳定出单'], ['clear', '清库存']] as const;
type Goal = (typeof GOALS)[number][0];

interface AdVariant { id: string; name: string; tag: string; headline: string; copy: string; bullet: string; }

function buildVariants(product: { name: string; description: string; category?: string }, platform: string, goal: Goal): AdVariant[] {
  const name = product.name;
  const desc = product.description || '品质之选';
  const cat = product.category ?? '家居日用';
  const urgency = goal === 'clear' ? '限时清仓，数量有限' : goal === 'launch' ? '新品上市，尝鲜价' : '口碑爆款，现货直发';
  return [
    { id: 'A', name: '利益驱动', tag: '价格 / 优惠 / 限时', headline: `${name} ${urgency}！${cat} 好物直接带走`, copy: `别错过这款${name}！${desc}。${urgency}，点击了解详情，领券下单更划算。`, bullet: `卖点：${cat} 刚需 · 现货直发 · 限时优惠` },
    { id: 'B', name: '场景种草', tag: '使用场景 / 生活方式', headline: `有了${name}，生活更省心`, copy: `忙碌一天回到家，${desc}的场景里，${name} 就是那个提升幸福感的小物件。看看它怎么融入你的日常。`, bullet: '场景：日常 / 送礼 / 收纳升级' },
    { id: 'C', name: '信任背书', tag: '品质 / 销量 / 口碑', headline: `大家都在买的${name}，品质看得见`, copy: `${cat} 品类热卖，${name} 累计好评如潮。加固包装、48 小时发货、质量问题包退换。放心下单，售后无忧。`, bullet: '背书：热卖 · 好评 · 售后保障' },
  ];
}

function budgetAdvice(platform: string, goal: Goal) {
  const daily = goal === 'launch' ? 200 : goal === 'stable' ? 150 : 100;
  const split = platform === '亚马逊' ? '搜索广告（SP）60% · 展示广告（SD）25% · 品牌广告（SB）15%' : platform === 'TikTok' ? '短视频加热 60% · 直播投流 40%' : '搜索广告 50% · 社媒 40% · 展示 10%';
  const note = goal === 'launch' ? '新品期以拉新为主，先跑自动广告收集关键词，再转手动优化' : goal === 'stable' ? '稳定期 30% 防御（品牌词）+ 70% 进攻（品类词与竞品词）' : '清库存期集中预算在转化词与受众重定向，控制 ACOS 上限';
  return { daily, split, note };
}

function abAdvice(variants: AdVariant[]) {
  return { pairs: `先测「${variants[0].name}」vs「${variants[2].name}」（风格差异最大）`, period: '测试周期 7-14 天，每组预算一致', metric: '核心指标：CTR（点击率）、CVR（转化率）、ACOS（投产比）', judge: 'CTR 低优化素材与标题；CVR 低优化落地页与价格；ACOS 高下调出价或砍词' };
}

export function AdsAssistant() {
  const { state } = useDomainStore();
  const toast = useToast();
  const products = state.platformListings.map((listing) => state.products.find((item) => item.id === listing.productId)).filter((item, index, arr) => item && arr.findIndex((p) => p?.id === item.id) === index);
  const [productId, setProductId] = useState('');
  const [platform, setPlatform] = useState<MarketplacePlatform>('亚马逊');
  const [goal, setGoal] = useState<Goal>('launch');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ variants: AdVariant[]; media: string; ab: ReturnType<typeof abAdvice>; budget: ReturnType<typeof budgetAdvice> } | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const product = products.find((item) => item?.id === productId);

  const generate = () => {
    if (!product) return;
    setGenerating(true);
    window.setTimeout(() => {
      const variants = buildVariants(product, platform, goal);
      setResult({ variants, media: `主图：白底商品图 + 场景图；视频：15-30 秒实物演示（可在 AI 生图生视频中生成），${goal === 'launch' ? '建议 2 条测试素材' : '每周轮换 1 条'}`, ab: abAdvice(variants), budget: budgetAdvice(platform, goal) });
      setGenerating(false);
      setChosen(null);
    }, 1200);
  };

  const copy = (text: string, label: string) => {
    try { navigator.clipboard.writeText(text); toast.show(`${label}已复制`); } catch { toast.show('复制失败，请手动选择'); }
  };

  return <div className="page-stack">
    <div className="section-heading"><div><span className="eyebrow">AI 广告助手</span><h1>多套广告文案与投放策略</h1><p>选商品、平台与广告目标，AI 生成 3 套文案方案、A/B 测试建议与预算分配。</p></div></div>
    <section className="panel" style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap' }}><div className="h5-field" style={{ margin: 0 }}><label>选择商品</label><select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">请选择商品</option>{products.map((item) => item && <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="h5-field" style={{ margin: 0 }}><label>投放平台</label><select value={platform} onChange={(event) => setPlatform(event.target.value as MarketplacePlatform)}><option>亚马逊</option><option>TikTok</option><option>独立站</option></select></div><div className="h5-field" style={{ margin: 0 }}><label>广告目标</label><select value={goal} onChange={(event) => setGoal(event.target.value as Goal)}>{GOALS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div><button className="h5-btn primary" disabled={!product || generating} onClick={generate}>{generating ? 'AI 生成中…' : '✨ 生成广告方案'}</button></section>
    {result && <section className="page-stack" style={{ gap: '1.4rem' }}>
      <section><div className="section-heading"><div><span className="eyebrow">A / B / C 文案方案</span><h2>三套不同风格的广告文案</h2></div></div><div className="goal-grid">{result.variants.map((variant) => <div key={variant.id} className="goal-card" style={{ cursor: 'default', minHeight: 220 }}><span className="goal-number">{variant.id} · {variant.name}</span><strong style={{ fontSize: '0.95rem' }}>{variant.headline}</strong><span style={{ fontSize: '0.74rem', lineHeight: 1.6 }}>{variant.copy}</span><small style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>{variant.tag}<br />{variant.bullet}</small><div style={{ marginTop: 'auto', display: 'flex', gap: '0.4rem' }}><button className="h5-btn ghost" style={{ minHeight: 30, padding: '0.25rem 0.6rem', fontSize: '0.72rem' }} onClick={() => copy(`${variant.headline}\n${variant.copy}\n${variant.bullet}`, `${variant.name}方案`)}>复制</button><button className={`h5-btn ${chosen === variant.id ? 'primary' : 'ghost'}`} style={{ minHeight: 30, padding: '0.25rem 0.6rem', fontSize: '0.72rem' }} onClick={() => setChosen(variant.id)}>{chosen === variant.id ? '已选择 ✓' : '选此方案'}</button></div></div>)}</div></section>
      <section className="content-grid">
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">A/B 测试建议</span><h2>怎么测</h2></div></div><div className="detail-lines"><p><b>先测组合</b><span>{result.ab.pairs}</span></p><p><b>测试周期</b><span>{result.ab.period}</span></p><p><b>核心指标</b><span>{result.ab.metric}</span></p><p><b>判断标准</b><span>{result.ab.judge}</span></p></div></div>
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">预算分配</span><h2>怎么投</h2></div></div><div className="detail-lines"><p><b>建议日预算</b><span>¥{result.budget.daily}/天起步</span></p><p><b>渠道分配</b><span>{result.budget.split}</span></p><p><b>策略</b><span>{result.budget.note}</span></p></div></div>
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">素材方向</span><h2>广告素材</h2></div></div><p className="h5-desc">{result.media}</p></section>
    </section>}
  </div>;
}
