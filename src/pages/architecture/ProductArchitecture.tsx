const layers = [
  ['用户与端', '企业负责人 · 商品/销售/合规/履约人员 · 平台运营方 · 服务商', 'Web 工作台 / 微信小程序'],
  ['业务入口', '做好一个商品 · 找到一个客户 · 完成一次合规处理 · 做一份报价 · 管理一次履约', '从业务目标进入，不从技术能力进入'],
  ['业务对象', '商品 · 客户 · 线索 · 询价 · 报价 · 合规案件 · 订单 · 履约 · 服务商', '每个场景都有长期可维护的业务对象'],
  ['业务处理', '采集完善 · 匹配筛选 · 内容经营 · 风险检查 · 任务协同 · 触达报价', '处理过程产生候选结果，确认点清晰可见'],
  ['业务沉淀', '正式数据 · 版本记录 · 任务通知 · 文件素材 · 风险事件 · 审计记录', '确认后写回，沉淀为下一步业务动作'],
];

export function ProductArchitecture({ navigate }: { navigate: (route: string) => void }) {
  return <div className="page-stack"><div className="page-intro"><div><span className="eyebrow">产品架构 / 工作方式</span><h1>从业务目标，到可持续经营</h1><p>产品不是一组孤立的处理入口，而是一条让结果回到业务对象、继续推动业务的主线。</p></div><button type="button" onClick={() => navigate('/architecture/system')}>查看系统架构 →</button></div><section className="architecture-stack">{layers.map(([name, detail, note], index) => <div className={`architecture-layer layer-${index + 1}`} key={name}><div className="layer-index">0{index + 1}</div><div><span className="eyebrow">{name}</span><h2>{detail}</h2><p>{note}</p></div>{index < layers.length - 1 && <span className="layer-arrow" aria-hidden="true">↓</span>}</div>)}</section><section className="architecture-callout"><span className="eyebrow">核心判断</span><strong>场景只是入口，业务对象才是系统的长期资产。</strong><p>因此商品处理会回到商品档案，客户画像会回到客户资料，合规结果会影响商品和订单是否可以继续，报价版本会继续承接商机与订单。</p></section></div>;
}
