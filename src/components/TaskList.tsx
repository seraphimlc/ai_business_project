import type { Task } from '../domain/types';
import { StatusBadge } from './StatusBadge';

export function TaskList({ tasks, compact = false }: { tasks: Task[]; compact?: boolean }) {
  if (!tasks.length) return <div className="empty-state"><strong>当前没有待处理事项</strong><span>新的确认、跟进和风险处理会出现在这里。</span></div>;
  return <div className={`task-list ${compact ? 'is-compact' : ''}`}>{tasks.map((task) => <div className="task-row" key={task.id}>
    <div className="task-mark" aria-hidden="true" />
    <div className="task-copy"><strong>{task.title}</strong><span>{task.objectType} · {task.objectId}</span></div>
    <StatusBadge status={task.status} />
  </div>)}</div>;
}
