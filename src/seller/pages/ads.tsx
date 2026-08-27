import { useState } from 'react';
import { useDomainStore } from '../../domain/store';
import { useToast } from '../../h5/components';

export function AdsAssistant() {
  const { state } = useDomainStore();
  const toast = useToast();
  const products = state.platformListings.map((listing) => state.products.find((item) => item.id === listing.productId)).filter((item, index, arr) => item && arr.findIndex((p) => p?.id === item.id) === index);
  const [productId, setProductId] = useState('');
  const [platform, setPlatform] = useState('亚马逊');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ headline: string; copy: string; bullets: string; media: string; advice: string } | null>(null);
  const product = products.find((item) => item?.id === productId);

  const generate = () => {
    if (!product) return;
    setGenerating(true);
    window.setTimeout(() => {
      const name = product.name;
      const cat = product.category ?? '家居日用';
      setResult({
        headline: `【${platform}】${name} | 高转化广告标题`,
        copy: `别错过这款${name}！${product.description || `${cat} 品质之选`}，现货直发、支持批量。限时优惠，点击了解详情。`,
        bullets: [`卖点 1：${cat} 场景刚需，转化率高`, `卖点 2：现货直发，物流快`, `卖点 3：支持批量 / 定制，利润空间好`].join('\n'),
        media: `主图：白底商品图 + 使用场景图；视频：15-30 秒实物演示短视频（可在 AI 生图生视频中生成）`,
        advice: `建议日预算 ¥100-200 起步，先跑自动广告收集关键词，再转手动广告优化 ACOS；素材每周更新一轮测试。`,
      });
      setGenerating(false);
    }, 1200);
  };

  const copy = (text: string, label: string) => {
    try { navigator.clipboard.writeText(text); toast.show(`${label}已复制`); } catch { toast.show('复制失败，请手动选择'); }
  };

  return <div className="page-stack">
    <div className="section-heading"><div><span className="eyebrow">AI 广告助手</span><h1>生成广告文案与投放建议</h1><p>选商品和投放平台，AI 生成标题、文案、素材方向与预算建议。</p></div></div>
    <section className="panel" style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap' }}><div className="h5-field" style={{ margin: 0 }}><label>选择商品</label><select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">请选择商品</option>{products.map((item) => item && <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="h5-field" style={{ margin: 0 }}><label>投放平台</label><select value={platform} onChange={(event) => setPlatform(event.target.value)}><option>亚马逊</option><option>TikTok</option><option>独立站</option></select></div><button className="h5-btn primary" disabled={!product || generating} onClick={generate}>{generating ? 'AI 生成中…' : '✨ 生成广告素材'}</button></section>
    {result && <section className="page-stack" style={{ gap: '1.4rem' }}>
      <div className="panel"><div className="panel-heading"><div><span className="eyebrow">广告标题</span><h2>标题与文案</h2></div><button className="text-button" type="button" onClick={() => copy(`${result.headline}\n\n${result.copy}`, '广告文案')}>复制 →</button></div><div className="detail-lines"><p><b>标题</b><span>{result.headline}</span></p><p><b>正文</b><textarea style={{ minHeight: '72px', width: '100%' }} defaultValue={result.copy} /></p></div></div>
      <div className="panel"><div className="panel-heading"><div><span className="eyebrow">卖点</span><h2>广告卖点</h2></div><button className="text-button" type="button" onClick={() => copy(result.bullets, '卖点')}>复制 →</button></div><textarea style={{ minHeight: '88px', width: '100%' }} defaultValue={result.bullets} /></div>
      <div className="panel"><div className="panel-heading"><div><span className="eyebrow">AI 建议</span><h2>素材与投放</h2></div></div><div className="detail-lines"><p><b>素材方向</b><span>{result.media}</span></p><p><b>投放建议</b><span>{result.advice}</span></p></div></div>
    </section>}
  </div>;
}
