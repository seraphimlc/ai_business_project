import { useDomainStore } from '../../domain/store';
import { selectProjectRows } from '../../domain/selectors';
import type { DomainAction } from '../../domain/types';
import { ALL_DOMAINS, MODE_LABELS, PLATFORM_ACTOR } from './shared';

export function AdminProjects({ navigate }: { navigate: (route: string) => void }) {
  const { state, dispatch } = useDomainStore();
  const projects = selectProjectRows(state, PLATFORM_ACTOR);
  const run = (action: DomainAction) => { try { dispatch(action); } catch { /* 忽略非法转换 */ } };
  return (
    <div className="page-stack">
      <button className="back-link" type="button" onClick={() => navigate('/admin')}>← 返回运营总览</button>
      <div className="page-intro"><div><span className="eyebrow">平台运营 / 项目场景配置</span><h1>项目与场景配置</h1><p>按地区、行业与项目组合场景能力，配置外贸监管模式（9810 / 9710 / 1039），决定企业工作区可使用哪些业务域。</p></div></div>
      {projects.map((project) => (
        <section className="panel" key={project.id}>
          <div className="panel-heading">
            <div><span className="eyebrow">项目 / {project.region}</span><h2>{project.name}</h2></div>
            <div className="mode-tags">{project.modes.map((mode) => <span className="mode-tag" key={mode}><b>{mode}</b>{MODE_LABELS[mode] ?? mode}</span>)}</div>
          </div>
          <div className="flow-object-facts">
            <p><b>状态</b><span>{project.status === '启用' ? '运行中' : '已停用'}</span></p>
            <p><b>已启用业务域</b><span>{project.enabledDomains.length} / {ALL_DOMAINS.length}</span></p>
          </div>
          <div className="domain-grid">{ALL_DOMAINS.map((domain) => { const enabled = project.enabledDomains.includes(domain); return <button type="button" className={enabled ? 'domain-switch is-on' : 'domain-switch'} key={domain} onClick={() => run({ type: 'toggleProjectDomain', actor: PLATFORM_ACTOR, projectId: project.id, domain, idempotencyKey: `toggle-${project.id}-${domain}` })}><span>{enabled ? '✓' : '+'}</span><strong>{domain}</strong><small>{enabled ? '已启用' : '未启用'}</small></button>; })}</div>
        </section>
      ))}
      <div className="admin-footnote">项目场景配置决定该地区/行业/项目的企业工作区开放哪些业务域；停用业务域后，相关场景入口不再对企业工作区开放，历史数据与处理记录保留。</div>
    </div>
  );
}
