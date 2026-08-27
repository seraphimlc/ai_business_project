import { useDomainStore } from '../../domain/store';
import { selectEnterpriseRows, selectTimeline } from '../../domain/selectors';
import { StatusBadge } from '../../components/StatusBadge';
import { Timeline } from '../../components/Timeline';
import type { DomainAction } from '../../domain/types';
import { PLATFORM_ACTOR } from './shared';

export function AdminEnterprise({ navigate }: { navigate: (route: string) => void }) {
  const { state, dispatch } = useDomainStore();
  const rows = selectEnterpriseRows(state, PLATFORM_ACTOR);
  const run = (action: DomainAction) => { try { dispatch(action); } catch { /* 演示状态机拒绝非法转换时忽略 */ } };
  return (
    <div className="page-stack">
      <button className="back-link" type="button" onClick={() => navigate('/admin')}>← 返回运营总览</button>
      <div className="page-intro"><div><span className="eyebrow">平台运营 / 企业管理</span><h1>企业管理</h1><p>审核企业入驻、查看各企业经营进度与风险，平台按项目授权范围管理企业数据。</p></div></div>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">企业列表</span><h2>{rows.length} 家企业</h2></div></div>
        <div className="admin-table">
          <div className="admin-table-head"><span>企业</span><span>状态</span><span>商品</span><span>订单</span><span>开放风险</span><span>处理中场景</span><span>操作</span></div>
          {rows.map((row) => <div className="admin-table-row" key={row.id}>
            <button className="link-cell" type="button" onClick={() => navigate(`/admin/enterprises/${row.id}`)}>{row.name}</button>
            <span>{row.status === '待审核' ? <b className="warn-text">待审核入驻</b> : row.status === '启用' ? '已入驻' : '已停用'}</span>
            <span>{row.products}</span><span>{row.orders}</span><span>{row.openRisks > 0 ? <b className="risk-text">{row.openRisks}</b> : 0}</span><span>{row.activeScenes}</span>
            <span className="row-actions">{row.status === '待审核' ? <><button type="button" onClick={() => run({ type: 'approveEnterpriseAdmission', actor: PLATFORM_ACTOR, organizationId: row.id, idempotencyKey: `admit-${row.id}` })}>通过入驻</button><button type="button" onClick={() => run({ type: 'rejectEnterpriseAdmission', actor: PLATFORM_ACTOR, organizationId: row.id, reason: '演示驳回', idempotencyKey: `reject-${row.id}` })}>驳回</button></> : <button type="button" onClick={() => navigate(`/admin/enterprises/${row.id}`)}>查看详情 →</button>}</span>
          </div>)}
        </div>
      </section>
      <div className="admin-footnote">企业入驻申请在企业主体建档后进入「待审核」，由平台运营人员通过后正式启用并纳入项目授权范围；驳回后保留企业档案与审计记录。</div>
    </div>
  );
}

export function AdminEnterpriseDetail({ id, navigate }: { id: string; navigate: (route: string) => void }) {
  const { state } = useDomainStore();
  const org = state.organizations.find((item) => item.id === id);
  if (!org) return <div className="page-stack"><button className="back-link" type="button" onClick={() => navigate('/admin/enterprises')}>← 返回企业管理</button><p className="empty-state">企业不存在</p></div>;
  const byOrg = <T extends { organizationId: string }>(collection: T[]) => collection.filter((item) => item.organizationId === org.id);
  const products = byOrg(state.products); const orders = byOrg(state.orders); const risks = byOrg(state.risks); const scenes = byOrg(state.sceneRuns); const requests = byOrg(state.serviceRequests);
  const project = state.platformProjects.find((item) => item.id === org.projectId);
  const timeline = selectTimeline(state, 'Organization', org.id, PLATFORM_ACTOR);
  return (
    <div className="page-stack">
      <button className="back-link" type="button" onClick={() => navigate('/admin/enterprises')}>← 返回企业管理</button>
      <div className="page-intro"><div><span className="eyebrow">企业详情 / {org.projectId === 'project-nanjing' ? '南京项目' : '温州项目'}</span><h1>{org.name}</h1><p>{org.status === '待审核' ? '入驻申请待审核' : org.status === '启用' ? '已入驻平台运营项目' : '已停用'} · 业务数据按项目授权范围可见</p></div><StatusBadge status={org.status} /></div>
      <section className="metric-strip">
        <div><span>商品</span><strong>{products.length}</strong><small>经营中的商品主档</small></div>
        <div><span>订单</span><strong>{orders.length}</strong><small>已确认订单</small></div>
        <div><span>开放风险</span><strong>{risks.filter((r) => !['已解除', '已关闭', '已豁免'].includes(r.status)).length}</strong><small>合规风险项</small></div>
        <div><span>处理中场景</span><strong>{scenes.filter((s) => ['处理中', '待确认', '待补充'].includes(s.status)).length}</strong><small>跨端实时同步</small></div>
      </section>
      <section className="content-grid">
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">项目与场景</span><h2>{project?.name ?? org.projectId}</h2></div></div>
          <div className="flow-object-facts">
            <p><b>业务模式</b><span>{project?.modes.join(' / ') ?? '未配置'}</span></p>
            <p><b>启用业务域</b><span>{project ? `${project.enabledDomains.length} 个` : '—'}</span></p>
            <p><b>服务需求</b><span>{requests.length} 项</span></p>
          </div>
          <div className="quick-links"><button type="button" onClick={() => navigate('/admin/projects')}>项目场景配置 →</button></div>
        </div>
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">合规与履约风险</span><h2>开放风险</h2></div></div>
          {risks.length === 0 ? <p className="empty-state">暂无风险项</p> : <div className="task-stack">{risks.map((risk) => <div className="task-row" key={risk.id}><span className="task-mark">!</span><div><strong>{risk.title}</strong><span>合规案件 · {risk.status}</span></div></div>)}</div>}
        </div>
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">处理记录</span><h2>企业档案变更与场景处理</h2></div></div><Timeline entries={timeline} /></section>
      {scenes.length === 0 && <p className="empty-state">该企业暂无进行中的场景处理</p>}
    </div>
  );
}
