import { selectDashboardSummary, selectPendingTasks, selectRoleVisibleRecords } from '../domain/selectors';
import type { Actor, DomainState } from '../domain/types';
import { ObjectSummary } from '../components/ObjectSummary';
import { TaskList } from '../components/TaskList';

const actor: Actor = { userId: 'user-enterprise-owner', organizationId: 'org-enterprise-wenzhou', projectIds: ['project-wenzhou'], role: 'enterprise_owner' };

const modules = [
  ['product', '商品管理', '建档、素材、内容与发布', '📦'], ['leads', '客户与线索', '获客、画像、触达与跟进', '🧭'], ['quotation', '询价与报价', '需求、匹配、报价与商机', '📄'],
  ['compliance', '合规处理', '境内 / 境外案件与整改', '🛡️'], ['order', '订单与履约', '订单、节点、库存与风险', '🚚'], ['lkb', 'AI 内容工作台', '生图 / 生视频', '✨'],
] as const;

export function WorkspaceHome({ navigate, state }: { navigate: (route: string) => void; state: DomainState }) {
  const summary = selectDashboardSummary(state, actor);
  const records = selectRoleVisibleRecords(state, actor);
  const tasks = selectPendingTasks(state, actor).slice(0, 6);
  const openRisks = state.risks.filter((item) => item.organizationId === actor.organizationId && !['已解除', '已关闭', '已豁免'].includes(item.status));
  return <div className="page-stack">
    <section className="metric-strip" aria-label="工作区概览"><div><span>待处理事项</span><strong>{summary.pendingTasks}</strong><small>确认、跟进与风险</small></div><div><span>开放风险</span><strong>{summary.openRisks}</strong><small>需要继续处理</small></div><div><span>处理中场景</span><strong>{summary.activeScenes}</strong><small>跨端实时同步</small></div><div><span>商品档案</span><strong>{summary.products}</strong><small>持续经营中</small></div></section>
    <section><div className="section-heading"><div><span className="eyebrow">01 / 功能模块</span><h2>从功能开始处理业务</h2></div></div><div className="goal-grid">{modules.map(([route, title, detail, icon]) => <button key={route} className="goal-card" type="button" onClick={() => navigate(`/${route}`)}><span className="goal-number">{icon}</span><strong>{title}</strong><span>{detail}</span><b>→</b></button>)}</div></section>
    <section className="content-grid"><div className="panel panel-tasks"><div className="panel-heading"><div><span className="eyebrow">02 / 我的工作</span><h2>待处理事项</h2></div></div><TaskList tasks={tasks} /></div><div className="panel panel-objects"><div className="panel-heading"><div><span className="eyebrow">03 / 业务数据</span><h2>正在经营的对象</h2></div></div><div className="object-grid"><ObjectSummary label="商品" name={records.products[0]?.name ?? '暂无商品'} status={records.products[0]?.status ?? '草稿'} meta="内容、合规与发布" onOpen={() => navigate('/product')} /><ObjectSummary label="采购商线索" name={records.leads[0]?.name ?? '暂无线索'} status={records.leads[0]?.status ?? '待筛选'} meta="画像、触达与跟进" onOpen={() => navigate('/leads')} /><ObjectSummary label="合规案件" name="商品出海合规" status={records.complianceCases[0]?.status ?? '待受理'} meta="材料、风险与复核" onOpen={() => navigate('/compliance')} /></div></div></section>
    {openRisks.length > 0 && <section><div className="section-heading"><div><span className="eyebrow">04 / 风险预警</span><h2>需要处理的合规风险</h2></div><button className="text-button" type="button" onClick={() => navigate('/compliance')}>去处理 →</button></div><div className="risk-list">{openRisks.map((risk) => <div key={risk.id} className="risk-row"><span>!</span><div><strong>{risk.title}</strong><small>案件 {risk.caseId} · {risk.status}</small></div></div>)}</div></section>}
  </div>;
}
