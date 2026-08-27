import type { DomainState } from '../../domain/types';

const tools = [
  ['/lkb', 'AI 生图 / 生视频', '商品图、场景图、短视频、A+ 内容', '✨'],
  ['/listing', 'AI 生成 Listing', '亚马逊标题与五点、TikTok 脚本、独立站文案', '📝'],
  ['/sourcing', 'AI 选品分析', '市场热度、趋势、竞争与机会评分', '🔎'],
  ['/compliance', 'AI 合规助手', '按站点/类目查询认证与合规要求', '🛡️'],
  ['/ads', 'AI 广告助手', '广告文案、卖点与投放建议', '📣'],
] as const;

export function SellerHome({ navigate, state }: { navigate: (route: string) => void; state: DomainState }) {
  return <div className="page-stack">
    <section><div className="section-heading"><div><span className="eyebrow">AI 卖家工具</span><h1>为跨境卖家提供的 AI 功能</h1><p>经营管理请使用主业务系统；这里的 AI 工具帮你做内容、Listing、选品、合规与广告。</p></div></div><div className="goal-grid">{tools.map(([route, title, detail, icon]) => <button key={route} className="goal-card" type="button" onClick={() => navigate(route)}><span className="goal-number">{icon}</span><strong>{title}</strong><span>{detail}</span><b>→</b></button>)}</div></section>
    <section><div className="section-heading"><div><span className="eyebrow">快速开始</span><h2>从你的商品出发</h2></div></div><div className="content-grid"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">示例商品</span><h2>选一个商品试试</h2></div></div><div className="task-list is-compact">{state.platformListings.slice(0, 4).map((listing) => { const product = state.products.find((item) => item.id === listing.productId); return <button key={listing.id} className="task-row" type="button" style={{ textAlign: 'left', width: '100%' }} onClick={() => navigate(`/listing?product=${listing.productId}`)}><span className="task-mark" /><div className="task-copy"><strong>{product?.name ?? listing.productId}</strong><span>{listing.platform} · {listing.title.slice(0, 40)}</span></div><span className="row-arrow">→</span></button>; })}</div></div><div className="panel"><div className="panel-heading"><div><span className="eyebrow">说明</span><h2>AI 工具怎么用</h2></div></div><div className="task-list is-compact"><div className="task-row"><span className="task-mark" /><div className="task-copy"><strong>AI 生成 Listing</strong><span>选商品 → 一键生成多平台文案 → 复制到你的店铺</span></div></div><div className="task-row"><span className="task-mark" /><div className="task-copy"><strong>AI 生图生视频</strong><span>在极创工作台生成商品图、场景图与短视频</span></div></div><div className="task-row"><span className="task-mark" /><div className="task-copy"><strong>AI 选品 / 合规 / 广告</strong><span>输入类目或站点，获取分析、建议与文案</span></div></div></div></div></div></section>
  </div>;
}
