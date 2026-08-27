import type { TimelineEntry } from '../domain/selectors';

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return <div className="timeline">{entries.map((entry) => <div className="timeline-row" key={entry.id}><span className="timeline-dot" /><div><strong>{entry.label}</strong><span>{entry.at.replace('T', ' ').slice(0, 16)} {entry.status ? `· ${entry.status}` : ''}</span></div></div>)}</div>;
}
