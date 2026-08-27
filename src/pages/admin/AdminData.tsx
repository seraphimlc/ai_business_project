import { useDomainStore } from '../../domain/store';
import { selectEnterpriseRows, selectModeVolume, selectPlatformOverview } from '../../domain/selectors';
import { MODE_LABELS, PLATFORM_ACTOR } from './shared';

export function AdminData({ navigate }: { navigate: (route: string) => void }) {
  const { state } = useDomainStore();
  const overview = selectPlatformOverview(state, PLATFORM_ACTOR);
  const rows = selectEnterpriseRows(state, PLATFORM_ACTOR);
  const volumes = selectModeVolume(state, PLATFORM_ACTOR);
  const complianceRisks = state.risks.filter((risk) => !['已解除', '已关闭', '已豁免'].includes(risk.status));
  const fulfillmentRisks = state.riskEvents.filter((event) => !['已解除', '已关闭', '已接受'].includes(event.status));
  return (
    <div className="page-stack">
      <button className="back-link" type="button" onClick={() => navigate('/admin')}>← 返回运营总览</button>
      <div className="page-intro"><div><span className="eyebrow">平台运营 / 运营数据</span><h1>运营数据与风险概览</h1><p>跨企业汇总经营数据、服务进度与风险状态，平台按项目授权范围读取各企业数据。</p></div></div>
      <section className="metric-strip">
        <div><span>入驻企业</span><strong>{overview.enterprises}</strong><small>正式启用</small></div>
        <div><span>服务商</span><strong>{overview.providers}</strong><small>合规与物流</small></div>
        <div><span>合规风险</span><strong>{overview.openComplianceRisks}</strong><small>开放风险项</small></div>
        <div><span>履约风险</span><strong>{overview.openFulfillmentRisks}</strong><small>风险事件</small></div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">企业维度</span><h2>各企业经营与服务进度</h2></div></div>
        <div className="admin-table">
          <div className="admin-table-head"><span>企业</span><span>状态</span><span>商品</span><span>订单</span><span>开放风险</span><span>处理中场景</span><span>服务需求</span></div>
          {rows.map((row) => <div className="admin-table-row" key={row.id}>
            <button className="link-cell" type="button" onClick={() => navigate(`/admin/enterprises/${row.id}`)}>{row.name}</button>
            <span>{row.status === '待审核' ? '待审核' : '已入驻'}</span><span>{row.products}</span><span>{row.orders}</span><span>{row.openRisks}</span><span>{row.activeScenes}</span><span>{row.services}</span>
          </div>)}
        </div>
      </section>
      <section className="content-grid">
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">模式承载</span><h2>外贸监管模式分布</h2></div></div>
          <div className="mode-grid">{volumes.map((row) => <div className="mode-card" key={row.mode}><b>{row.mode}</b><span>{row.label}</span><strong>{row.volume}</strong><small>承载订单与发布</small></div>)}</div>
        </div>
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">风险告警</span><h2>开放风险</h2></div></div>
          {complianceRisks.length + fulfillmentRisks.length === 0 ? <p className="empty-state">暂无开放风险</p> : <div className="task-stack">
            {complianceRisks.map((risk) => <div className="task-row" key={risk.id}><span className="task-mark">!</span><div><strong>{risk.title}</strong><span>合规风险 · {risk.status}</span></div></div>)}
            {fulfillmentRisks.map((event) => <div className="task-row" key={event.id}><span className="task-mark">↗</span><div><strong>履约风险事件</strong><span>订单履约 · {event.status}</span></div></div>)}
          </div>}
        </div>
      </section>
      <div className="admin-footnote">演示数据说明：各企业指标来自同一套本地业务对象（商品、订单、风险、场景处理、服务需求），平台运营视角按项目授权聚合展示。{volumes.map((v) => `${v.mode}（${MODE_LABELS[v.mode] ?? ''}）`).join('、')} 为当前配置的监管模式。</div>
    </div>
  );
}
