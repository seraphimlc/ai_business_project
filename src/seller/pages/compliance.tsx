import { useState } from 'react';
import { useDomainStore } from '../../domain/store';
import { StatusBadge } from '../../components/StatusBadge';
import { COMPLIANCE_MATRIX, COMPLIANCE_CATEGORIES, COMPLIANCE_SITES, COMPLIANCE_QA, HS_MAP, matchQa, type ComplianceSite } from '../data/regulations';

type Tab = 'query' | 'diagnose' | 'hs' | 'qa' | 'certs';

export function ComplianceAssistant() {
  const { state } = useDomainStore();
  const [tab, setTab] = useState<Tab>('query');

  return <div className="page-stack">
    <div className="section-heading"><div><span className="eyebrow">AI 合规助手</span><h1>跨境法规与合规中心</h1><p>合规查询、商品合规诊断、HS 编码归类、境内/境外合规问答与认证档案。</p></div></div>
    <div className="product-tabs">{([['query', '合规查询'], ['diagnose', '商品诊断'], ['hs', 'HS 编码'], ['qa', '合规问答'], ['certs', '我的认证']] as [Tab, string][]).map(([key, label]) => <button key={key} className={tab === key ? 'tab is-active' : 'tab'} type="button" onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === 'query' && <QueryPanel />}
    {tab === 'diagnose' && <DiagnosePanel />}
    {tab === 'hs' && <HsPanel />}
    {tab === 'qa' && <QaPanel />}
    {tab === 'certs' && <CertsPanel />}
  </div>;
}

function QueryPanel() {
  const [site, setSite] = useState<ComplianceSite>('亚马逊美国');
  const [category, setCategory] = useState<string>(COMPLIANCE_CATEGORIES[0]);
  const pack = COMPLIANCE_MATRIX[site][category];
  return <div className="page-stack" style={{ gap: '1.4rem' }}>
    <section className="panel" style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap' }}><div className="h5-field" style={{ margin: 0 }}><label>销售站点</label><select value={site} onChange={(event) => setSite(event.target.value as ComplianceSite)}>{COMPLIANCE_SITES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="h5-field" style={{ margin: 0 }}><label>商品类目</label><select value={category} onChange={(event) => setCategory(event.target.value)}>{COMPLIANCE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">强制认证</span><h2>{site} · {category} 认证要求</h2></div></div>{pack.certs.length === 0 ? <div className="empty-state"><strong>该类目在该站点无强制认证</strong><span>仍建议关注 REACH（欧盟）等通用法规与平台要求。</span></div> : <div className="product-table"><div className="product-table-head"><span>认证</span><span>适用地区</span><span>要求与标志</span><span>有效期</span></div>{pack.certs.map((cert) => <div key={cert.name} className="product-row" style={{ cursor: 'default' }}><div><strong>{cert.name}</strong><small>{cert.region}</small></div><span className="h5-badge danger">强制</span><span style={{ fontSize: '0.78rem' }}>{cert.scope}</span><span style={{ color: 'var(--muted)', fontSize: '0.74rem' }}>{cert.validity}</span></div>)}</div>}</section>
    <section className="content-grid"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">标签要求</span><h2>标签与标识</h2></div></div><div className="task-list is-compact">{pack.labels.length === 0 ? <div className="empty-state"><strong>无特殊标签要求</strong></div> : pack.labels.map((item) => <div key={item} className="task-row"><span className="task-mark" /><div className="task-copy"><strong>{item}</strong></div></div>)}</div></div><div className="panel"><div className="panel-heading"><div><span className="eyebrow">包装与环保</span><h2>包装与环保要求</h2></div></div><div className="task-list is-compact">{pack.packaging.length === 0 ? <div className="empty-state"><strong>无特殊包装要求</strong></div> : pack.packaging.map((item) => <div key={item} className="task-row"><span className="task-mark" /><div className="task-copy"><strong>{item}</strong></div></div>)}</div></div></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">平台要求</span><h2>{site} 平台合规</h2></div></div><div className="task-list is-compact">{pack.platform.map((item) => <div key={item} className="task-row"><span className="task-mark" /><div className="task-copy"><strong>{item}</strong></div></div>)}</div></section>
  </div>;
}

function DiagnosePanel() {
  const { state } = useDomainStore();
  const products = state.products.filter((item) => item.status !== '已停用');
  const [productId, setProductId] = useState('');
  const [site, setSite] = useState<ComplianceSite>('亚马逊美国');
  const [result, setResult] = useState<{ missing: string[]; risk: '高' | '中' | '低'; steps: string[] } | null>(null);
  const product = products.find((item) => item.id === productId);
  const category = product?.category ?? '';
  const categoryKey = COMPLIANCE_CATEGORIES.find((item) => item.startsWith(category)) ?? '家居收纳';

  const diagnose = () => {
    if (!product) return;
    const certs = state.productCerts.filter((item) => item.productId === product.id);
    const have = new Set(certs.filter((item) => item.status === '有效').map((item) => item.certType));
    const required = COMPLIANCE_MATRIX[site][categoryKey].certs;
    const missing = required.map((cert) => cert.name).filter((name) => !Array.from(have).some((h) => name.includes(h) || h.includes(name.split(' ')[0])));
    const risk: '高' | '中' | '低' = missing.length === 0 ? '低' : missing.length >= 3 ? '高' : '中';
    const steps = [
      missing.length ? `补齐缺失认证：${missing.join('、')}` : '认证齐全，可正常上架',
      '准备认证文件：证书/测试报告/符合性声明，上传到平台后台',
      site.includes('欧洲') ? '确认欧代信息与 EPR 注册号（包装/EEE/电池）' : '确认平台类目审核材料（UPC、危险品审核等）',
      '加贴标签与标志（CE/FCC/能效等），检查包装与说明书语言',
    ];
    setResult({ missing, risk, steps });
  };

  return <div className="page-stack" style={{ gap: '1.4rem' }}>
    <section className="panel" style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap' }}><div className="h5-field" style={{ margin: 0 }}><label>选择商品</label><select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">请选择商品</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="h5-field" style={{ margin: 0 }}><label>目标站点</label><select value={site} onChange={(event) => setSite(event.target.value as ComplianceSite)}>{COMPLIANCE_SITES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><button className="h5-btn primary" disabled={!product} onClick={diagnose}>✨ AI 诊断合规</button></section>
    {result && <>
      <section className="metric-strip" aria-label="诊断结果"><div><span>缺失认证</span><strong>{result.missing.length}</strong><small>{result.missing.length ? result.missing.join('、').slice(0, 30) : '无'}</small></div><div><span>合规风险</span><strong className={result.risk === '高' ? 'risk-text' : result.risk === '中' ? 'warn-text' : ''}>{result.risk}</strong><small>风险等级</small></div><div><span>已有认证</span><strong>{state.productCerts.filter((item) => item.productId === productId && item.status === '有效').length}</strong><small>有效认证</small></div></section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">AI 整改路径</span><h2>合规整改建议</h2></div></div><div className="detail-steps">{result.steps.map((step, index) => <li key={index}><span>0{index + 1}</span><strong>{step}</strong></li>)}</div><p className="admin-footnote">认证办理可委托第三方检测/认证服务商（CE/FCC/CPC 等均可代办）。</p></section>
    </>}
  </div>;
}

function HsPanel() {
  const { state } = useDomainStore();
  const products = state.products.filter((item) => item.category);
  const [productId, setProductId] = useState('');
  const product = products.find((item) => item.id === productId);
  const hs = product?.category ? HS_MAP[product.category] ?? HS_MAP[COMPLIANCE_CATEGORIES.find((item) => item.startsWith(product.category!)) ?? '家居收纳'] : undefined;
  return <div className="page-stack" style={{ gap: '1.4rem' }}>
    <section className="panel" style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end' }}><div className="h5-field" style={{ flex: 1, margin: 0 }}><label>选择商品</label><select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">请选择商品</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.category}）</option>)}</select></div></section>
    {hs && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">商品智能归类</span><h2>HS 编码建议</h2></div></div><div className="metric-strip" style={{ border: 'none', marginBottom: '1rem' }}><div><span>HS 编码</span><strong>{hs.code}</strong><small>前 8 位</small></div><div><span>归类名称</span><strong style={{ fontSize: '1.2rem' }}>{hs.name}</strong><small>{product?.category}</small></div></div><p className="h5-desc">{hs.note}</p><p className="admin-footnote">HS 编码决定进口关税、监管条件与退税；出口报关请以海关归类为准，复杂商品建议咨询报关行。</p></section>}
  </div>;
}

function QaPanel() {
  const [scope, setScope] = useState<'境内' | '境外'>('境外');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const ask = () => {
    const entry = matchQa(scope, question);
    setAnswer(entry ? entry.answer : '知识库暂未覆盖该问题，建议按站点类目使用「合规查询」查看认证要求。');
  };
  return <div className="page-stack" style={{ gap: '1.4rem' }}>
    <section className="panel" style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap' }}><div className="h5-field" style={{ margin: 0 }}><label>合规范围</label><select value={scope} onChange={(event) => setScope(event.target.value as '境内' | '境外')}><option value="境内">境内（出口合规准备）</option><option value="境外">境外（目标市场合规）</option></select></div><div className="h5-field" style={{ flex: 1, margin: 0, minWidth: 260 }}><label>输入问题</label><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：出口欧盟的电子商品需要什么认证？" /></div><button className="h5-btn primary" disabled={!question.trim()} onClick={ask}>✨ 提问</button></section>
    {answer && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">AI 回答</span><h2>{scope}合规 · 解答</h2></div></div><p className="h5-desc">{answer}</p></section>}
    <section><div className="section-heading"><div><span className="eyebrow">常见问题</span><h2>{scope}合规 · 高频问答</h2></div></div><div className="product-table"><div className="product-table-head"><span>问题</span><span>回答摘要</span></div>{COMPLIANCE_QA[scope].map((entry) => <div key={entry.question} className="product-row" style={{ cursor: 'default' }}><div><strong>{entry.question}</strong></div><span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{entry.answer.slice(0, 60)}…</span></div>)}</div></section>
  </div>;
}

function CertsPanel() {
  const { state } = useDomainStore();
  const certs = [...state.productCerts].sort((a, b) => (a.status === '有效' ? 1 : 0) - (b.status === '有效' ? 1 : 0));
  const pending = certs.filter((item) => item.status !== '有效');
  return <div className="page-stack" style={{ gap: '1.4rem' }}>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">认证档案</span><h2>我的商品认证</h2></div></div><div className="product-table"><div className="product-table-head"><span>商品</span><span>认证类型</span><span>状态</span><span>到期时间</span></div>{certs.map((cert) => { const product = state.products.find((item) => item.id === cert.productId); return <div key={cert.id} className="product-row" style={{ cursor: 'default' }}><div><strong>{product?.name ?? cert.productId}</strong><small>{cert.id}</small></div><span style={{ fontWeight: 700 }}>{cert.certType}</span><StatusBadge status={cert.status} /><span style={{ color: 'var(--muted)' }}>{cert.expireAt}</span></div>; })}</div>{pending.length > 0 && <p className="admin-footnote">有 {pending.length} 项认证即将到期或缺失：请在「商品诊断」中按站点生成整改路径，认证办理可委托检测认证服务商。</p>}</section>
  </div>;
}
