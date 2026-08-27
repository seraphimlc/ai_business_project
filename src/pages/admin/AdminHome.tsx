import { useDomainStore } from '../../domain/store';
import { selectEnterpriseRows, selectModeVolume, selectPlatformOverview, selectProviderRows, selectServiceQueue } from '../../domain/selectors';
import { MODE_LABELS, PLATFORM_ACTOR } from './shared';

export function AdminHome({ navigate }: { navigate: (route: string) => void }) {
  const { state } = useDomainStore();
  const overview = selectPlatformOverview(state, PLATFORM_ACTOR);
  const volumes = selectModeVolume(state, PLATFORM_ACTOR);
  const admissions = selectEnterpriseRows(state, PLATFORM_ACTOR).filter((row) => row.status === '待审核');
  const queue = selectServiceQueue(state, PLATFORM_ACTOR);
  const providers = selectProviderRows(state, PLATFORM_ACTOR);
  const totalRisks = overview.openComplianceRisks + overview.openFulfillmentRisks;
  return (
    <div className="page-stack">
      <div className="page-intro">
        <div><span className="eyebrow">平台运营工作区</span><h1>平台运营总览</h1><p>管理企业、服务商与项目配置，承载 9810 / 9710 / 1039 等外贸模式的服务流程。</p></div>
      </div>
      <section className="metric-strip" aria-label="平台运营概览">
        <div><span>入驻企业</span><strong>{overview.enterprises}</strong><small>另有 {overview.admissions} 家待审核</small></div>
        <div><span>服务商</span><strong>{overview.providers}</strong><small>合规与物流服务</small></div>
        <div><span>服务需求</span><strong>{overview.pendingServices}</strong><small>待受理或匹配中</small></div>
        <div><span>开放风险</span><strong>{totalRisks}</strong><small>合规 {overview.openComplianceRisks} · 履约 {overview.openFulfillmentRisks}</small></div>
        <div><span>项目</span><strong>{overview.projects}</strong><small>温州 / 南京</small></div>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">01 / 业务模式承载</span><h2>外贸监管模式</h2></div><button className="text-button" type="button" onClick={() => navigate('/admin/projects')}>项目配置 →</button></div>
        <div className="mode-grid">{volumes.map((row) => <div className="mode-card" key={row.mode}><b>{row.mode}</b><span>{row.label}</span><strong>{row.volume}</strong><small>承载订单与发布</small></div>)}</div>
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading"><div><span className="eyebrow">02 / 待办运营事项</span><h2>需要你处理</h2></div><button className="text-button" type="button" onClick={() => navigate('/admin/enterprises')}>企业管理 →</button></div>
          {admissions.length === 0 && queue.length === 0 ? <p className="empty-state">暂无待办运营事项</p> : <div className="task-stack">
            {admissions.map((row) => <div className="task-row" key={row.id}><span className="task-mark">▣</span><div><strong>{row.name}</strong><span>企业入驻申请待审核</span></div><button type="button" onClick={() => navigate(`/admin/enterprises/${row.id}`)}>审核 →</button></div>)}
            {queue.map((row) => <div className="task-row" key={row.id}><span className="task-mark">◎</span><div><strong>{row.orgName}</strong><span>服务需求：{row.inquirySummary}</span></div><button type="button" onClick={() => navigate('/admin/services')}>分配 →</button></div>)}
          </div>}
        </div>
        <div className="panel">
          <div className="panel-heading"><div><span className="eyebrow">03 / 服务商</span><h2>服务供给</h2></div><button className="text-button" type="button" onClick={() => navigate('/admin/providers')}>服务商管理 →</button></div>
          <div className="object-grid">{providers.map((row) => <div className="object-summary" key={row.id} onClick={() => navigate('/admin/providers')}><span className="eyebrow">服务商</span><strong>{row.name}</strong><span>承接 {row.assignedServices} 项 · 进行中 {row.activeServices} 项</span></div>)}</div>
          <div className="quick-links"><button type="button" onClick={() => navigate('/admin/data')}>运营数据与风险 →</button><button type="button" onClick={() => navigate('/admin/services')}>服务需求池 →</button></div>
        </div>
      </section>
      {MODE_LABELS['9810'] && <div className="admin-footnote">模式承载说明：演示数据中每个项目的模式按项目配置汇总订单与渠道发布数量，展示平台对 9810（海外仓出口）、9710（B2B 直接出口）、1039（市场采购贸易）的服务承载能力。</div>}
    </div>
  );
}
