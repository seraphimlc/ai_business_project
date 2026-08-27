import { useState } from 'react';
import { useDomainStore } from '../../domain/store';
import { StatusBadge } from '../../components/StatusBadge';
import { PRODUCT_ANALYSES, analyzeKeyword, type ProductAnalysis } from '../data/sourcing';
import { COMPLIANCE_SITES } from '../data/regulations';

export function SourcingAnalysis() {
  const { state } = useDomainStore();
  const [keyword, setKeyword] = useState('');
  const [site, setSite] = useState('亚马逊美国');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof analyzeKeyword> | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const candidates = PRODUCT_ANALYSES;

  const analyze = () => {
    setAnalyzing(true);
    window.setTimeout(() => { setResult(analyzeKeyword(keyword.trim(), site)); setAnalyzing(false); }, 900);
  };

  const statusOf = (id: string) => state.productCandidates.find((item) => item.id === id)?.status ?? '待评估';

  return <div className="page-stack">
    <div className="section-heading"><div><span className="eyebrow">AI 选品分析</span><h1>分析一个品类值不值得做</h1><p>输入品类或关键词，AI 给出市场、竞争、利润与打法建议；下方为 AI 已发现的机会与货源。</p></div></div>
    <section className="panel" style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap' }}><div className="h5-field" style={{ flex: 1, margin: 0, minWidth: 260 }}><label>品类 / 关键词</label><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="例如：宠物喂食器、露营灯、收纳篮" /></div><div className="h5-field" style={{ margin: 0 }}><label>目标站点</label><select value={site} onChange={(event) => setSite(event.target.value)}>{COMPLIANCE_SITES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><button className="h5-btn primary" disabled={!keyword.trim() || analyzing} onClick={analyze}>{analyzing ? '分析中…' : '✨ 开始分析'}</button></section>
    {result && <>
      <section className="metric-strip" aria-label="分析结果"><div><span>市场热度</span><strong>{result.heat}%</strong><small>需求规模</small></div><div><span>趋势</span><strong>{result.trend}</strong><small>近 90 天</small></div><div><span>季节性</span><strong style={{ fontSize: '1.1rem' }}>{result.season}</strong><small>备货参考</small></div><div><span>竞争程度</span><strong>{result.competition}</strong><small>卖家数量</small></div><div><span>机会评分</span><strong>{result.score}</strong><small>越高越值得做</small></div></section>
      <section className="content-grid"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">竞争结构</span><h2>市场与竞争</h2></div></div><div className="detail-lines"><p><b>头部集中度</b><span>{result.concentration}</span></p><p><b>价格带</b><span>{result.priceBand}</span></p><p><b>季节性</b><span>{result.season}</span></p></div></div><div className="panel"><div className="panel-heading"><div><span className="eyebrow">AI 建议</span><h2>打法与预算</h2></div></div><p className="h5-desc">{result.advice}</p><p className="admin-footnote">上架前请在「合规助手」按站点 + 类目查询认证要求。</p></div></section>
    </>}

    <section><div className="section-heading"><div><span className="eyebrow">AI 已发现的机会</span><h2>值得做的商品</h2><p>点击展开市场、利润、合规与打法详情</p></div></div><div className="page-stack" style={{ gap: '0.8rem' }}>{candidates.map((item) => <CandidateCard key={item.id} item={item} status={statusOf(item.id)} expanded={expanded === item.id} onToggle={() => setExpanded(expanded === item.id ? null : item.id)} />)}</div></section>
  </div>;
}

function CandidateCard({ item, status, expanded, onToggle }: { item: ProductAnalysis; status: string; expanded: boolean; onToggle: () => void }) {
  return <div className="panel" style={{ padding: 0 }}>
    <button type="button" onClick={onToggle} style={{ alignItems: 'center', background: 'transparent', borderRadius: 0, color: 'inherit', display: 'flex', gap: '1rem', padding: '1.1rem 1.4rem', textAlign: 'left', width: '100%' }}>
      <div style={{ minWidth: 120 }}><span className="h5-badge neutral">{item.category}</span><div style={{ marginTop: '0.3rem' }}><StatusBadge status={status} /></div></div>
      <div style={{ flex: 1, minWidth: 0 }}><strong style={{ font: '1.2rem var(--font-display)' }}>{item.name}</strong><div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '0.25rem' }}>{item.reason}</div></div>
      <div style={{ display: 'grid', gap: '0.15rem', justifyItems: 'end', minWidth: 90 }}><span className="goal-number" style={{ fontSize: '1.4rem' }}>{item.score}分</span><small style={{ color: 'var(--muted)' }}>{item.trend}</small></div>
      <span style={{ color: 'var(--blue)', fontSize: '1.2rem' }}>{expanded ? '▾' : '▸'}</span>
    </button>
    {expanded && <div className="page-stack" style={{ gap: '1rem', padding: '0 1.4rem 1.4rem' }}>
      <section className="metric-strip" style={{ border: '1px solid var(--line)' }}><div><span>市场热度</span><strong>{item.heat}%</strong><small>需求规模</small></div><div><span>竞争</span><strong>{item.competition}</strong><small>{item.concentration}</small></div><div><span>毛利率</span><strong>{item.margin}%</strong><small>净利 ¥{item.netProfit}/单</small></div><div><span>合规风险</span><strong className={item.risk === '高' ? 'risk-text' : item.risk === '中' ? 'warn-text' : ''}>{item.risk}</strong><small>{item.riskNote}</small></div></section>
      <section className="content-grid">
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">市场与竞争</span><h2>机会分析</h2></div></div><div className="detail-lines"><p><b>趋势</b><span>{item.trend}</span></p><p><b>季节性</b><span>{item.season}</span></p><p><b>头部集中度</b><span>{item.concentration}</span></p><p><b>头部平均评论</b><span>{item.avgReviews}</span></p><p><b>建议价格带</b><span>{item.priceBand}</span></p></div></div>
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">利润测算</span><h2>单件成本与利润</h2></div></div><div className="detail-lines"><p><b>建议售价</b><span>¥{item.price}</span></p><p><b>采购成本</b><span>¥{item.cost}</span></p><p><b>头程物流</b><span>¥{item.freight}</span></p><p><b>平台佣金</b><span>{Math.round(item.commissionRate * 100)}%（¥{Math.round(item.price * item.commissionRate)}）</span></p><p><b>广告占比</b><span>{Math.round(item.adRate * 100)}%（¥{Math.round(item.price * item.adRate)}）</span></p><p><b>净利 / 单</b><span style={{ fontWeight: 800, color: 'var(--green)' }}>¥{item.netProfit}（毛利率 {item.margin}%）</span></p></div></div>
      </section>
      <section className="content-grid">
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">合规与风险</span><h2>合规要求</h2></div></div><div className="task-list is-compact">{item.compliance.map((cert) => <div key={cert} className="task-row"><span className="task-mark" /><div className="task-copy"><strong>{cert}</strong></div></div>)}</div><p className="admin-footnote">{item.riskNote}</p></div>
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">打法建议</span><h2>预算与打法</h2></div></div><div className="detail-lines"><p><b>试款预算</b><span>{item.budget}</span></p><p><b>打法</b><span>{item.playbook}</span></p></div></div>
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">货源</span><h2>可匹配供应商</h2></div></div><div className="product-table"><div className="product-table-head"><span>供应商</span><span>单价</span><span>起订量</span><span>评分</span></div>{item.suppliers.map((supplier) => <div key={supplier.name} className="product-row" style={{ cursor: 'default' }}><div><strong>{supplier.name}</strong></div><span style={{ fontWeight: 700 }}>¥{supplier.price}</span><span>MOQ {supplier.moq}</span><span>★ {supplier.rating}</span></div>)}</div></section>
    </div>}
  </div>;
}
