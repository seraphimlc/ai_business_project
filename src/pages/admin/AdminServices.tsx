import { useState } from 'react';
import { useDomainStore } from '../../domain/store';
import { selectServiceQueue, selectProviderRows } from '../../domain/selectors';
import type { DomainAction } from '../../domain/types';
import { PLATFORM_ACTOR } from './shared';

export function AdminServices({ navigate }: { navigate: (route: string) => void }) {
  const { state, dispatch } = useDomainStore();
  const queue = selectServiceQueue(state, PLATFORM_ACTOR);
  const providers = selectProviderRows(state, PLATFORM_ACTOR);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const run = (action: DomainAction) => { try { dispatch(action); } catch { /* 忽略 */ } };
  return (
    <div className="page-stack">
      <button className="back-link" type="button" onClick={() => navigate('/admin')}>← 返回运营总览</button>
      <div className="page-intro"><div><span className="eyebrow">平台运营 / 服务需求池</span><h1>服务需求池</h1><p>企业侧发起的物流、合规等综合服务需求在此受理、匹配并分配给服务商，承接后进入服务任务跟踪。</p></div></div>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">待处理需求</span><h2>{queue.length} 项</h2></div></div>
        {queue.length === 0 ? <p className="empty-state">当前没有待处理的服务需求</p> : <div className="admin-table">
          <div className="admin-table-head"><span>需求</span><span>企业</span><span>状态</span><span>分配服务商</span></div>
          {queue.map((row) => <div className="admin-table-row" key={row.id}>
            <b>{row.inquirySummary}</b>
            <span>{row.orgName || '平台代录'}</span>
            <span>{row.status}</span>
            <span className="row-actions">
              <select value={selected[row.id] ?? ''} onChange={(event) => setSelected((prev) => ({ ...prev, [row.id]: event.target.value }))}>
                <option value="">选择服务商…</option>
                {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </select>
              <button type="button" disabled={!selected[row.id]} onClick={() => { if (selected[row.id]) run({ type: 'assignServiceRequest', actor: PLATFORM_ACTOR, serviceRequestId: row.id, providerId: selected[row.id], idempotencyKey: `assign-${row.id}` }); }}>分配</button>
            </span>
          </div>)}
        </div>}
      </section>
      <div className="admin-footnote">服务需求承接后生成服务商处理任务；服务商提交处理结果，由企业或授权人员确认写回，平台运营人员全程可见需求、承接与完成状态。</div>
    </div>
  );
}
