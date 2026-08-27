import type { ReactNode } from 'react';

const toneFor = (status: string) => {
  if (['可经营', '已完成', '已通过', '已确认', '有效', '已生效', '已入库', '已发布'].includes(status)) return 'positive';
  if (['需整改', '失败', '超时', '异常', '已拒绝', '已退回', '履约异常'].includes(status)) return 'danger';
  if (['处理中', '待确认', '待复核', '待整改', '议价中', '客户已查看', '部分完成'].includes(status)) return 'attention';
  return 'neutral';
};

export function StatusBadge({ status, children }: { status: string; children?: ReactNode }) {
  return <span className={`status-badge status-${toneFor(status)}`}><i aria-hidden="true" />{children ?? status}</span>;
}
