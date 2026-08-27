import type { CatalogEntry } from '../domain/types';

export function ScenarioCard({ entry, onOpen }: { entry: CatalogEntry; onOpen: () => void }) {
  return <button className="scenario-card" type="button" onClick={onOpen}>
    <div className="scenario-card-top"><span className="scenario-kicker">{entry.domain}</span><span className="scenario-arrow" aria-hidden="true">↗</span></div>
    <h3>{entry.userVisibleName}</h3>
    <p>{entry.purpose}</p>
    <div className="scenario-card-foot"><span>{entry.relatedObjects.slice(0, 2).join(' / ')}</span><span>{entry.projectSource}</span></div>
  </button>;
}
