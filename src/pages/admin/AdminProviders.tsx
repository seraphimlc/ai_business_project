import { useDomainStore } from '../../domain/store';
import { selectProviderRows, selectServiceQueue } from '../../domain/selectors';
import { PLATFORM_ACTOR } from './shared';

export function AdminProviders({ navigate }: { navigate: (route: string) => void }) {
  const { state } = useDomainStore();
  const providers = selectProviderRows(state, PLATFORM_ACTOR);
  const queue = selectServiceQueue(state, PLATFORM_ACTOR);
  return (
    <div className="page-stack">
      <button className="back-link" type="button" onClick={() => navigate('/admin')}>← 返回运营总览</button>
      <div className="page-intro"><div><span className="eyebrow">平台运营 / 服务商管理</span><h1>服务商管理</h1><p>服务商承接平台分发的服务需求，处理被分配的任务，但不能越权确认企业正式业务数据。</p></div></div>
      <section className="metric-strip">
        <div><span>服务商</span><strong>{providers.length}</strong><small>已启用</small></div>
        <div><span>承接服务</span><strong>{providers.reduce((acc, p) => acc + p.assignedServices, 0)}</strong><small>累计分配</small></div>
        <div><span>进行中</span><strong>{providers.reduce((acc, p) => acc + p.activeServices, 0)}</strong><small>未完成服务</small></div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">服务商列表</span><h2>{providers.length} 家服务商</h2></div></div>
        <div className="admin-table">
          <div className="admin-table-head"><span>服务商</span><span>服务能力</span><span>评级</span><span>承接服务</span><span>进行中</span><span>关系</span></div>
          {providers.map((row, index) => <div className="admin-table-row" key={row.id}>
            <b>{row.name}</b>
            <span>{row.name.includes('物流') ? '物流运输 · 报关订舱' : '合规咨询 · 材料办理'}</span>
            <span>{'★'.repeat(Math.max(4 - index, 3))}</span>
            <span>{row.assignedServices}</span><span>{row.activeServices}</span><span>{row.relations} 家企业关系</span>
          </div>)}
        </div>
      </section>
      {queue.length > 0 && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">待分配服务需求</span><h2>来自企业侧的需求</h2></div><button className="text-button" type="button" onClick={() => navigate('/admin/services')}>去需求池 →</button></div><div className="task-stack">{queue.map((row) => <div className="task-row" key={row.id}><span className="task-mark">◎</span><div><strong>{row.orgName}</strong><span>{row.inquirySummary}</span></div></div>)}</div></section>}
      <div className="admin-footnote">服务商评级由平台按承接质量、时效与复核结果综合评定；服务商只能查看被分配的服务需求、案件、材料和任务。</div>
    </div>
  );
}
