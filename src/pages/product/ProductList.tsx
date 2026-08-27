import type { DomainState } from '../../domain/types';
import { selectObjectProgress } from '../../domain/selectors';
import { StatusBadge } from '../../components/StatusBadge';

const actor = { userId: 'user-enterprise-owner', organizationId: 'org-enterprise-wenzhou', projectIds: ['project-wenzhou'], role: 'enterprise_owner' as const };

export function ProductList({ state, navigate }: { state: DomainState; navigate: (route: string) => void }) {
  const products = state.products.filter((product) => product.organizationId === actor.organizationId && actor.projectIds.includes(product.projectId));
  return <div className="page-stack"><div className="product-table"><div className="product-table-head"><span>商品</span><span>生命周期</span><span>内容进度</span><span>合规进度</span><span>渠道进度</span><span /></div>{products.map((product) => { const progress = selectObjectProgress(state, 'Product', product.id, actor); return <button className="product-row" key={product.id} type="button" onClick={() => navigate(`/product/${product.id}`)}><div><strong>{product.name}</strong><small>{product.id} · 版本 {product.currentVersion}</small></div><StatusBadge status={progress.lifecycle} /><StatusBadge status={progress.content} /><StatusBadge status={progress.compliance} /><StatusBadge status={progress.channel} /><span className="row-arrow">→</span></button>; })}</div></div>;
}
