import { catalogEntries } from '../domain/catalog';
import { selectDashboardSummary, selectPendingTasks, selectRoleVisibleRecords } from '../domain/selectors';
import type { Actor, DomainState } from '../domain/types';
import { ObjectSummary } from '../components/ObjectSummary';
import { ScenarioCard } from '../components/ScenarioCard';
import { TaskList } from '../components/TaskList';

const actor: Actor = { userId: 'user-enterprise-owner', organizationId: 'org-enterprise-wenzhou', projectIds: ['project-wenzhou'], role: 'enterprise_owner' };
const goals = [
  ['做好一个商品', '商品建档与内容经营', 'product'], ['找到一个客户', '获客与客户经营', 'leads'], ['完成一次合规处理', '合规处理', 'compliance'],
  ['做一份报价', '询价与报价', 'quotation'], ['管理一次履约', '订单与供应链', 'order'], ['查看经营情况', '经营分析与报告', 'analytics'],
] as const;

export function WorkspaceHome({ navigate, state }: { navigate: (route: string) => void; state: DomainState }) {
  const summary = selectDashboardSummary(state, actor);
  const records = selectRoleVisibleRecords(state, actor);
  const tasks = selectPendingTasks(state, actor).slice(0, 4);
  const featured = catalogEntries.filter((entry) => ['商品建档与内容经营', '获客与客户经营', '合规处理', '询价与报价', '订单与供应链'].includes(entry.domain)).slice(0, 5);
  return <div className="page-stack">
    <section className="home-hero"><div><span className="eyebrow">企业工作区 / 今日工作</span><h1>把下一步业务，<em>做成结果。</em></h1><p>从一个业务目标开始，沿着真实对象推进，结果会回到商品、客户、合规、报价和订单里。</p><div className="hero-actions"><button type="button" onClick={() => navigate('/product')}>继续商品经营</button><button className="button-quiet" type="button" onClick={() => navigate('/tasks')}>查看我的工作</button></div></div><div className="hero-orbit"><span className="orbit-center">今天<br /><b>{summary.pendingTasks}</b><small>项待处理</small></span><i className="orbit-dot dot-one" /><i className="orbit-dot dot-two" /><i className="orbit-dot dot-three" /></div></section>
    <section className="metric-strip" aria-label="工作区概览"><div><span>待处理事项</span><strong>{summary.pendingTasks}</strong><small>确认、跟进与风险</small></div><div><span>开放风险</span><strong>{summary.openRisks}</strong><small>需要继续处理</small></div><div><span>处理中场景</span><strong>{summary.activeScenes}</strong><small>跨端实时同步</small></div><div><span>商品档案</span><strong>{summary.products}</strong><small>持续经营中</small></div></section>
    <section><div className="section-heading"><div><span className="eyebrow">01 / 业务目标</span><h2>你现在要做什么？</h2></div><button className="text-button" type="button" onClick={() => navigate('/catalog')}>查看全部场景 <span>→</span></button></div><div className="goal-grid">{goals.map(([title, domain, route]) => <button key={title} className="goal-card" type="button" onClick={() => navigate(`/${route}`)}><span className="goal-number">0{goals.findIndex((item) => item[0] === title) + 1}</span><strong>{title}</strong><span>{domain}</span><b>→</b></button>)}</div></section>
    <section className="content-grid"><div className="panel panel-tasks"><div className="panel-heading"><div><span className="eyebrow">02 / 我的工作</span><h2>待处理事项</h2></div><button className="text-button" type="button" onClick={() => navigate('/tasks')}>全部任务 →</button></div><TaskList tasks={tasks} /></div><div className="panel panel-objects"><div className="panel-heading"><div><span className="eyebrow">03 / 业务数据</span><h2>正在经营的对象</h2></div><button className="text-button" type="button" onClick={() => navigate('/data')}>打开数据 →</button></div><div className="object-grid"><ObjectSummary label="商品" name={records.products[0]?.name ?? '暂无商品'} status={records.products[0]?.status ?? '草稿'} meta="内容、合规与发布" onOpen={() => navigate('/product')} /><ObjectSummary label="采购商线索" name={records.leads[0]?.name ?? '暂无线索'} status={records.leads[0]?.status ?? '待筛选'} meta="画像、触达与跟进" onOpen={() => navigate('/leads')} /><ObjectSummary label="合规案件" name="商品出海合规" status={records.complianceCases[0]?.status ?? '待受理'} meta="材料、风险与复核" onOpen={() => navigate('/compliance')} /></div></div></section>
    <section><div className="section-heading"><div><span className="eyebrow">04 / 推荐入口</span><h2>从场景开始，而不是从功能开始</h2></div></div><div className="scenario-grid">{featured.map((entry) => <ScenarioCard entry={entry} key={entry.id} onOpen={() => navigate(`/catalog/${entry.id}`)} />)}</div></section>
  </div>;
}
