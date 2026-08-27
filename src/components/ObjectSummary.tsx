import { StatusBadge } from './StatusBadge';

export function ObjectSummary({ label, name, status, meta, onOpen }: { label: string; name: string; status: string; meta: string; onOpen?: () => void }) {
  return <div className="object-summary" onClick={onOpen} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} onKeyDown={(event) => { if (onOpen && event.key === 'Enter') onOpen(); }}>
    <span className="object-label">{label}</span><strong>{name}</strong><span className="object-meta">{meta}</span><StatusBadge status={status} />
  </div>;
}
