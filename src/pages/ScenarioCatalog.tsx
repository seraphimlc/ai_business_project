import { useMemo, useState } from 'react';
import { catalogEntries } from '../domain/catalog';
import { ScenarioCard } from '../components/ScenarioCard';

export function ScenarioCatalog({ navigate }: { navigate: (route: string) => void }) {
  const [query, setQuery] = useState(''); const [source, setSource] = useState('全部项目');
  const entries = useMemo(() => catalogEntries.filter((entry) => (!query || `${entry.userVisibleName}${entry.originalSourceName}${entry.domain}`.includes(query)) && (source === '全部项目' || entry.projectSource === source)), [query, source]);
  return <div className="page-stack"><div className="page-intro"><div><span className="eyebrow">场景目录 / 项目范围</span><h1>从场景进入解决方案</h1><p>保留原始项目范围，用统一的业务语言组织入口。相同业务流程共享底层业务对象，不重复建设。</p></div><div className="catalog-count"><strong>{entries.length}</strong><span>当前可见场景</span></div></div><div className="catalog-toolbar"><label>搜索场景<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索业务场景" /></label><label>项目来源<select value={source} onChange={(event) => setSource(event.target.value)}><option>全部项目</option><option>温州项目</option><option>南京项目</option></select></label><span className="toolbar-note">温州 42 · 南京 12 · 产品层统一归入业务场景</span></div><div className="scenario-grid catalog-grid">{entries.map((entry) => <ScenarioCard entry={entry} key={entry.id} onOpen={() => navigate(`/catalog/${entry.id}`)} />)}</div></div>;
}
