import { useState } from 'react';
import { useDomainStore } from '../../domain/store';
import { useToast } from '../../h5/components';
import type { MarketplacePlatform } from '../../domain/types';

const LANGS = [['en', '英语'], ['de', '德语'], ['ja', '日语'], ['es', '西班牙语']] as const;
type Lang = (typeof LANGS)[number][0];

interface Generated { title: string; bullets: string; keywords: string; script: string; tags: string; description: string; features: string; }

function localize(lang: Lang, product: { name: string; description: string; category?: string; price?: number }, extra: string) {
  const name = product.name; const desc = product.description || '优质跨境商品'; const cat = product.category ?? '家居日用'; const e = extra.trim() ? `，卖点：${extra.trim()}` : '';
  const L: Record<Lang, { title: (a: string) => string; bullet: string[]; keywords: string[]; hook: string; cta: string; webDesc: string; feature: string[] }> = {
    en: { title: (d) => `${name} - ${d} | ${cat} for Home & Business Use${e}`, bullet: ['【Material】' + desc + ', durable for long-term use.', '【Scenarios】Home / warehouse / retail / gift.', '【Specs】Standard spec, see detail page.', '【Packaging】Reinforced packing, ships within 48h.', '【After-sales】Free return for quality issues.'], keywords: [name, cat, desc.split(',')[0], 'best seller', 'wholesale', 'gift'], hook: `See this ${name} - instant click!`, cta: `Order now, limited-time deal! @${name} #finds #home`, webDesc: `${name}\n\n${desc}${e}\n\n✅ In stock  ✅ Custom OK  ✅ Bulk discount\n\nShips worldwide.`, feature: ['Durable & well finished', 'Multi-scenario use', 'Fast shipping', 'Custom & bulk available'] },
    de: { title: (d) => `${name} – ${d} | ${cat} für Zuhause & Gewerbe${e}`, bullet: ['【Material】' + desc + ', robust für den Langzeitgebrauch.', '【Einsatz】Zuhause / Lager / Handel / Geschenk.', '【Spezifikation】Standardmaß, siehe Detailseite.', '【Verpackung】Sichere Verpackung, Versand in 48h.', '【Service】Rückerstattung bei Qualitätsproblemen.'], keywords: [name, cat, desc.split(',')[0], 'Bestseller', 'Großhandel', 'Geschenk'], hook: `${name} – direkt überzeugen!`, cta: `Jetzt bestellen, begrenztes Angebot! @${name} #finds`, webDesc: `${name}\n\n${desc}${e}\n\n✅ Auf Lager  ✅ Individuell  ✅ Mengenrabatt\n\nWeltweiter Versand.`, feature: ['Robust & hochwertig', 'Mehrere Einsatzbereiche', 'Schneller Versand', 'Individuell & Großhandel'] },
    ja: { title: (d) => `${name} - ${d} | 家庭用・業務用 ${cat}${e}`, bullet: ['【材質】' + desc + '、長期使用に耐える作り。', '【用途】家庭/倉庫/店舗/ギフト。', '【仕様】標準仕様、詳細は商品ページ。', '【梱包】強化梱包、48時間以内に出荷。', '【アフター】品質問題は返品対応。'], keywords: [name, cat, desc.split(',')[0], 'ベストセラー', '卸売', 'ギフト'], hook: `この${name}、見てください！`, cta: `今すぐ注文、期間限定！@${name} #おすすめ`, webDesc: `${name}\n\n${desc}${e}\n\n✅ 在庫あり  ✅ カスタム対応  ✅ 数量割引\n\n世界中へお届け。`, feature: ['丈夫で高品質', '多用途', 'スピード出荷', 'カスタム・卸売対応'] },
    es: { title: (d) => `${name} - ${d} | ${cat} para hogar y negocio${e}`, bullet: ['【Material】' + desc + ', resistente para uso prolongado.', '【Usos】Hogar / almacén / tienda / regalo.', '【Especificaciones】Estándar, ver página de detalle.', '【Embalaje】Embalaje reforzado, envío en 48h.', '【Posventa】Devolución por problemas de calidad.'], keywords: [name, cat, desc.split(',')[0], 'más vendido', 'mayoreo', 'regalo'], hook: `¡Mira este ${name}, te va a encantar!`, cta: `¡Pide ya, oferta por tiempo limitado! @${name} #finds`, webDesc: `${name}\n\n${desc}${e}\n\n✅ En stock  ✅ Personalizable  ✅ Descuento por volumen\n\nEnvío mundial.`, feature: ['Resistente y de calidad', 'Multi-uso', 'Envío rápido', 'Personalizable y al por mayor'] },
  };
  return { L: L[lang], title: L[lang].title(desc) };
}

export function ListingGenerator({ navigate }: { navigate: (route: string) => void }) {
  const { state, dispatch } = useDomainStore();
  const toast = useToast();
  const query = new URLSearchParams(window.location.search);
  const preselected = query.get('product') ?? '';
  const products = state.platformListings.map((listing) => state.products.find((item) => item.id === listing.productId)).filter((item, index, arr) => item && arr.findIndex((p) => p?.id === item.id) === index);
  const [productId, setProductId] = useState(preselected);
  const [lang, setLang] = useState<Lang>('en');
  const [sellingPoints, setSellingPoints] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<Generated | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, string>>({});

  const product = products.find((item) => item?.id === productId);

  const generate = () => {
    if (!product) return;
    setGenerating(true);
    window.setTimeout(() => {
      const g = localize(lang, product, sellingPoints);
      setResult({
        title: g.title, bullets: g.L.bullet.join('\n'), keywords: g.L.keywords.join(', '),
        script: `【开场 3 秒】${g.L.hook}\n【展示】实物演示 ${product.description || product.name}\n【卖点】${sellingPoints.trim() || '颜值在线、性价比拉满'}\n【结尾】${g.L.cta}`,
        tags: g.L.keywords.slice(0, 5).join(', '),
        description: g.L.webDesc, features: g.L.feature.join('\n'),
      });
      setGenerating(false);
      setSaved(new Set());
    }, 1200);
  };

  const copy = (text: string, label: string) => {
    try { navigator.clipboard.writeText(text); toast.show(`${label}已复制`); } catch { toast.show('复制失败，请手动选择'); }
  };

  const save = (platform: MarketplacePlatform) => {
    if (!product || !result) return;
    const keywords = (edits[`${platform}-keywords`] ?? result.keywords).split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
    dispatch({ type: 'saveListingContent', actor: { userId: 'user-enterprise-owner', organizationId: 'org-enterprise-wenzhou', projectIds: ['project-wenzhou'], role: 'enterprise_owner' }, productId: product.id, platform, title: edits[`${platform}-title`] ?? result.title, keywords, description: edits[`${platform}-desc`] ?? result.description, idempotencyKey: `save-listing-${product.id}-${platform}-${Date.now().toString(36)}` });
    setSaved((current) => new Set(current).add(platform));
    toast.show(`已保存到 ${platform} Listing`);
  };

  const savedTitle = (platform: MarketplacePlatform) => product ? state.platformListings.find((item) => item.productId === product.id && item.platform === platform)?.title : undefined;

  return <div className="page-stack">
    <div className="section-heading"><div><span className="eyebrow">AI 生成 Listing</span><h1>多语言多平台商品文案</h1><p>选择商品与语言，AI 生成亚马逊、TikTok、独立站的 Listing 文案，可编辑、复制、一键保存到商品。</p></div></div>
    <section className="panel" style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap' }}><div className="h5-field" style={{ margin: 0 }}><label>选择商品</label><select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">请选择商品</option>{products.map((item) => item && <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="h5-field" style={{ margin: 0 }}><label>语言</label><select value={lang} onChange={(event) => setLang(event.target.value as Lang)}>{LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></div><div className="h5-field" style={{ flex: 1, margin: 0, minWidth: 240 }}><label>补充卖点 <small>选填</small></label><input value={sellingPoints} onChange={(event) => setSellingPoints(event.target.value)} placeholder="例如：加厚钢材；可拆卸；现货直发" /></div><button className="h5-btn primary" disabled={!product || generating} onClick={generate}>{generating ? 'AI 生成中…' : '✨ 生成 Listing'}</button></section>
    {result && <section className="page-stack" style={{ gap: '1.4rem' }}>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">亚马逊</span><h2>标题 · 五点 · 关键词</h2></div><div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}><button className="text-button" type="button" onClick={() => copy(`${result.title}\n\n${result.bullets}\n\n关键词：${result.keywords}`, '亚马逊文案')}>复制全部 →</button><button className="h5-btn primary" style={{ minHeight: 32, padding: '0.3rem 0.8rem' }} onClick={() => save('亚马逊')}>保存到 Listing{saved.has('亚马逊') ? ' ✓' : ''}</button></div></div><div className="detail-lines"><p><b>标题</b><textarea style={{ minHeight: '52px' }} value={edits['亚马逊-title'] ?? result.title} onChange={(event) => setEdits((current) => ({ ...current, '亚马逊-title': event.target.value }))} /></p><p><b>五点描述</b><textarea style={{ minHeight: '130px' }} value={edits['亚马逊-bullets'] ?? result.bullets} onChange={(event) => setEdits((current) => ({ ...current, '亚马逊-bullets': event.target.value }))} /></p><p><b>关键词（逗号分隔）</b><textarea style={{ minHeight: '44px' }} value={edits['亚马逊-keywords'] ?? result.keywords} onChange={(event) => setEdits((current) => ({ ...current, '亚马逊-keywords': event.target.value }))} /></p></div>{savedTitle('亚马逊') && <p className="admin-footnote">该平台当前保存标题：{savedTitle('亚马逊')}</p>}</section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">TikTok</span><h2>短视频脚本 · 标签</h2></div><div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}><button className="text-button" type="button" onClick={() => copy(`${result.script}\n\n标签：${result.tags}`, 'TikTok 内容')}>复制 →</button><button className="h5-btn primary" style={{ minHeight: 32, padding: '0.3rem 0.8rem' }} onClick={() => save('TikTok')}>保存到 Listing{saved.has('TikTok') ? ' ✓' : ''}</button></div></div><textarea style={{ minHeight: '120px', width: '100%' }} value={edits['TikTok-script'] ?? result.script} onChange={(event) => setEdits((current) => ({ ...current, 'TikTok-script': event.target.value }))} /><p className="admin-footnote">标签：{result.tags}</p></section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">独立站</span><h2>标题 · 描述 · 特性</h2></div><div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}><button className="text-button" type="button" onClick={() => copy(`${result.title}\n\n${result.description}\n\n${result.features}`, '独立站文案')}>复制 →</button><button className="h5-btn primary" style={{ minHeight: 32, padding: '0.3rem 0.8rem' }} onClick={() => save('独立站')}>保存到 Listing{saved.has('独立站') ? ' ✓' : ''}</button></div></div><div className="detail-lines"><p><b>标题</b><textarea style={{ minHeight: '44px' }} value={edits['独立站-title'] ?? result.title} onChange={(event) => setEdits((current) => ({ ...current, '独立站-title': event.target.value }))} /></p><p><b>描述</b><textarea style={{ minHeight: '110px' }} value={edits['独立站-desc'] ?? result.description} onChange={(event) => setEdits((current) => ({ ...current, '独立站-desc': event.target.value }))} /></p><p><b>特性</b><textarea style={{ minHeight: '80px' }} value={edits['独立站-features'] ?? result.features} onChange={(event) => setEdits((current) => ({ ...current, '独立站-features': event.target.value }))} /></p></div></section>
    </section>}
  </div>;
}
