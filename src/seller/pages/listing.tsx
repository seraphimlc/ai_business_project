import { useState } from 'react';
import { useDomainStore } from '../../domain/store';
import { useToast } from '../../h5/components';

export function ListingGenerator({ navigate }: { navigate: (route: string) => void }) {
  const { state } = useDomainStore();
  const toast = useToast();
  const query = new URLSearchParams(window.location.search);
  const preselected = query.get('product') ?? '';
  const products = state.platformListings.map((listing) => state.products.find((item) => item.id === listing.productId)).filter((item, index, arr) => item && arr.findIndex((p) => p?.id === item.id) === index);
  const [productId, setProductId] = useState(preselected);
  const [sellingPoints, setSellingPoints] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ amazonTitle: string; amazonBullets: string; amazonKeywords: string; tiktokScript: string; webCopy: string } | null>(null);

  const product = products.find((item) => item?.id === productId);

  const generate = () => {
    if (!product) return;
    setGenerating(true);
    window.setTimeout(() => {
      const name = product.name;
      const desc = product.description || '优质跨境商品';
      const cat = product.category ?? '家居日用';
      const extra = sellingPoints.trim() ? `，卖点：${sellingPoints.trim()}` : '';
      setResult({
        amazonTitle: `${name} - ${desc.split(',')[0]} | ${cat} for Home & Business Use${extra}`,
        amazonBullets: [`【材质做工】${desc}，工艺稳定，适合长期使用。`, `【适用场景】家庭 / 仓库 / 门店 / 送礼，多场景通用。`, `【规格参数】标准规格，尺寸与容量见详情页。`, `【包装发货】加固包装，48 小时内发货，支持批量采购。`, `【售后服务】质量问题包退换，客服 24 小时内响应。${extra}`].join('\n'),
        amazonKeywords: [name, cat, desc.split(',')[0] ?? '', 'best seller', 'wholesale', 'gift'].filter(Boolean).join(', '),
        tiktokScript: `【开场 3 秒】看这个 ${name}，直接种草！\n【展示】实物演示 ${desc}\n【卖点】${extra || '颜值在线、性价比拉满'}\n【结尾】直播间下单立减，手慢无！@${name} #好物分享`,
        webCopy: `${name}\n\n${desc}${extra}\n\n✅ 现货直发　✅ 支持定制　✅ 批量优惠\n\n现在下单，全球速递到家。`,
      });
      setGenerating(false);
    }, 1200);
  };

  const copy = (text: string, label: string) => {
    try { navigator.clipboard.writeText(text); toast.show(`${label}已复制`); } catch { toast.show('复制失败，请手动选择'); }
  };

  return <div className="page-stack">
    <div className="section-heading"><div><span className="eyebrow">AI 生成 Listing</span><h1>生成多平台商品文案</h1><p>选一个商品，AI 自动生成亚马逊、TikTok、独立站的 Listing 文案，可编辑后复制。</p></div></div>
    <section className="panel"><div className="h5-field"><label>选择商品</label><select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">请选择商品</option>{products.map((item) => item && <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="h5-field"><label>补充卖点 <small>选填，用「；」分隔</small></label><textarea value={sellingPoints} onChange={(event) => setSellingPoints(event.target.value)} placeholder="例如：加厚钢材；可拆卸；现货直发" /></div><button className="h5-btn primary" disabled={!product || generating} onClick={generate}>{generating ? 'AI 生成中…' : '✨ 生成 Listing'}</button></section>
    {result && <section className="page-stack" style={{ gap: '1.4rem' }}>
      <div className="panel"><div className="panel-heading"><div><span className="eyebrow">亚马逊</span><h2>标题 · 五点 · 关键词</h2></div><button className="text-button" type="button" onClick={() => copy(`${result.amazonTitle}\n\n${result.amazonBullets}\n\n关键词：${result.amazonKeywords}`, '亚马逊文案')}>复制全部 →</button></div><div className="detail-lines"><p><b>标题</b><textarea style={{ minHeight: '52px' }} defaultValue={result.amazonTitle} /></p><p><b>五点描述</b><textarea style={{ minHeight: '130px' }} defaultValue={result.amazonBullets} /></p><p><b>关键词</b><textarea style={{ minHeight: '44px' }} defaultValue={result.amazonKeywords} /></p></div></div>
      <div className="panel"><div className="panel-heading"><div><span className="eyebrow">TikTok</span><h2>短视频卖点脚本</h2></div><button className="text-button" type="button" onClick={() => copy(result.tiktokScript, 'TikTok 脚本')}>复制 →</button></div><textarea style={{ minHeight: '120px', width: '100%' }} defaultValue={result.tiktokScript} /></div>
      <div className="panel"><div className="panel-heading"><div><span className="eyebrow">独立站</span><h2>商品页文案</h2></div><button className="text-button" type="button" onClick={() => copy(result.webCopy, '独立站文案')}>复制 →</button></div><textarea style={{ minHeight: '110px', width: '100%' }} defaultValue={result.webCopy} /></div>
    </section>}
  </div>;
}
