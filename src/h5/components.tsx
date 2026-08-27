import { Component, createContext, useCallback, useContext, useState, type PropsWithChildren, type ReactNode } from 'react';

export function categoryEmoji(category?: string): string {
  const map: Record<string, string> = { 仓储设备: '🏗️', 家居收纳: '🧺', 灯具照明: '💡', 厨具餐厨: '🍳', 五金工具: '🔧', 家纺布艺: '🛏️' };
  return map[category ?? ''] ?? '📦';
}

export function statusTone(status: string): 'positive' | 'warn' | 'danger' | 'neutral' | 'info' {
  if (['已确认', '已入库', '已触达', '已通过', '已接受', '已完成', '已发布', '已生效', '有效', '启用', '已解除', '已归档', '已解决', '已发送', '已承接'].includes(status)) return 'positive';
  if (['待确认', '待处理', '待受理', '处理中', '待筛选', '待整改', '待复核', '议价中', '待补充', '待入库', '待选择', '匹配中', '待发布', '待执行', '待跟进', '客户已查看'].includes(status)) return 'warn';
  if (['已拒绝', '已取消', '失败', '已停用', '需整改', '履约异常', '已过期', '超时', '已驳回', '已作废', '已暂停', '写回失败'].includes(status)) return 'danger';
  if (['草稿', '新建', '已分配', '跟进中', '已更新', '部分完成', '执行中'].includes(status)) return 'info';
  return 'neutral';
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`h5-badge ${statusTone(status)}`}>{status}</span>;
}

export function H5Header({ title, sub, back, action, onBack }: { title: string; sub?: string; back?: boolean; action?: ReactNode; onBack?: () => void }) {
  return (
    <header className="h5-header">
      {back && <button className="h5-back" onClick={onBack} aria-label="返回">‹</button>}
      <div>
        <h1>{title}</h1>
        {sub && <div className="h5-sub">{sub}</div>}
      </div>
      <span className="h5-spacer" />
      {action}
    </header>
  );
}

export function H5Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="h5-section">
      <h3 className="h5-section-title">{title}{note && <small>{note}</small>}</h3>
      {children}
    </section>
  );
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return <div className="h5-empty"><i>{icon}</i><span>{text}</span></div>;
}

export function ProductCard({ name, price, unit, category, onClick, compact }: { name: string; price?: number; unit?: string; category?: string; onClick: () => void; compact?: boolean }) {
  return (
    <button className="h5-product" onClick={onClick} style={{ textAlign: 'left' }}>
      <div className="h5-thumb"><i>{categoryEmoji(category)}</i></div>
      <div className="h5-product-info">
        <strong>{name}</strong>
        {!compact && price !== undefined && <span className="h5-price"><small>¥</small>{price}<small> / {unit ?? '件'}</small></span>}
      </div>
    </button>
  );
}

export function Steps({ steps, current }: { steps: { label: string; at?: string; state: 'done' | 'current' | 'todo' }[]; current?: string }) {
  return (
    <div className="h5-steps">
      {steps.map((step, index) => (
        <div key={index} className={`h5-step ${step.state === 'done' ? 'is-done' : step.state === 'current' ? 'is-current' : ''}`}>
          <div><strong>{step.label}</strong>{step.at && <span>{step.at}</span>}</div>
        </div>
      ))}
    </div>
  );
}

interface ToastContextValue { show: (message: string) => void; }
const ToastContext = createContext<ToastContextValue>({ show: () => undefined });

export function useToast(): ToastContextValue { return useContext(ToastContext); }

export function ToastProvider({ children }: PropsWithChildren) {
  const [message, setMessage] = useState<string | null>(null);
  const show = useCallback((next: string) => {
    setMessage(next);
    window.setTimeout(() => setMessage((current) => (current === next ? null : current)), 2200);
  }, []);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message && <div className="h5-toast" role="status">{message}</div>}
    </ToastContext.Provider>
  );
}

interface ErrorBoundaryState { error: Error | null; }
export class H5ErrorBoundary extends Component<PropsWithChildren<{ onReset: () => void }>, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="h5-page" style={{ padding: '2rem 1rem' }}>
          <div className="h5-card">
            <h2 style={{ marginTop: 0 }}>演示出现异常</h2>
            <p className="h5-desc">{this.state.error.message}</p>
            <div className="h5-btn-row">
              <button className="h5-btn ghost" onClick={() => this.setState({ error: null })}>重试</button>
              <button className="h5-btn primary" onClick={this.props.onReset}>重置演示数据</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function runAction<A>(dispatch: (action: A) => unknown, action: A): string | undefined {
  try {
    dispatch(action);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message.replace(/^[A-Z_]+:\s*/, '') : '操作失败';
  }
}
