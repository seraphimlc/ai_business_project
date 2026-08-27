const flows = [
  ['商品经营', '商品 · SKU · 素材 · 商品版本 · 合规案件 · 渠道发布', '草稿 → 待完善 → 可经营 / 需整改', '商品内容、合规与发布互相影响'],
  ['线索经营', '线索 · 客户画像 · 触达任务 · 跟进记录 · 商机', '待筛选 → 待确认 → 已入库 → 跟进中', '确认后入库，继续分配、触达和转商机'],
  ['合规处理', '合规案件 · 风险项 · 整改任务 · 材料 · 复核', '待受理 → 处理中 → 待整改 → 待复核 → 已通过', '风险和材料共同决定案件是否通过'],
  ['询价与报价', '询价 · 匹配结果 · 服务需求 · 物流报价 · 报价版本', '草稿 → 待确认 → 已发送 → 客户反馈', '版本只增不改，反馈继续进入商机或跟进'],
  ['订单与履约', '订单 · 履约单 · 节点 · 风险事件 · 库存 · 入库', '待确认 → 执行中 → 部分完成 → 已完成', '节点异常产生任务，处理后继续履约'],
];

export function BusinessObjectMap({ navigate }: { navigate: (route: string) => void }) {
  return <div className="page-stack"><div className="page-intro"><div><span className="eyebrow">业务对象 / 五条主线</span><h1>场景之间，通过对象连接</h1><p>一个场景完成后，不是结束，而是把正式结果交给下一个业务环节。</p></div><button type="button" onClick={() => navigate('/architecture/product')}>回到产品架构 →</button></div><div className="object-map">{flows.map(([flow, objects, lifecycle, detail], index) => <article className="object-map-row" key={flow}><span className="flow-number">0{index + 1}</span><div><span className="eyebrow">{flow}</span><h2>{objects}</h2><p>{detail}</p></div><strong>{lifecycle}</strong><span className="object-map-arrow">→</span></article>)}</div></div>;
}
