const layers = [
  ['访问端', 'Web 企业工作台 / Web 平台运营台 / 微信小程序', '统一入口、跨端续接与响应式展示'],
  ['访问与安全', '身份、组织、项目、角色、任务负责人、审计', '先验证身份和数据范围，再允许领域动作'],
  ['场景与流程运行', '场景目录 / 处理记录 / 候选结果 / 状态流转 / 任务与通知', '承接输入、处理、确认、写回、重试和异常恢复'],
  ['业务领域服务', '商品与内容 / 客户与线索 / 合规与通关 / 询价报价 / 订单履约', '每个领域拥有自己的对象、状态和业务规则'],
  ['数据与文件', '业务数据库 / 版本库 / 文件与素材 / 关系索引 / 审计日志', '正式数据与候选结果分层存储，所有确认可追溯'],
  ['外部连接', '海关与采购商数据 / 物流报价 / 渠道发布 / 报告与服务商系统', '通过适配器接入，失败保留请求，不阻塞核心业务数据'],
];

export function SystemArchitecture({ navigate }: { navigate: (route: string) => void }) {
  return <div className="page-stack"><div className="page-intro"><div><span className="eyebrow">系统架构 / 技术支撑</span><h1>每一次处理，都有业务归属</h1><p>技术结构服务于产品主线：请求进入场景，状态进入流程，结果写入业务对象，外部失败可恢复。</p></div><button type="button" onClick={() => navigate('/architecture/product')}>查看产品架构 →</button></div><section className="system-stack">{layers.map(([name, detail, note], index) => <div className="system-layer" key={name}><div className="layer-index">0{index + 1}</div><div className="system-content"><span className="eyebrow">{name}</span><h2>{detail}</h2><p>{note}</p></div>{index < layers.length - 1 && <span className="system-arrow" aria-hidden="true">↓</span>}</div>)}</section><section className="flow-contract"><div><span className="eyebrow">请求与数据流</span><h2>输入 → 处理 → 候选 → 确认 → 写回</h2></div><div className="contract-pills"><span>source version 冲突保护</span><span>幂等键防重复</span><span>失败可重试</span><span>操作可审计</span></div></section></div>;
}
