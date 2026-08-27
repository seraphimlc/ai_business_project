import type { DomainState } from '../../domain/types';
import { selectObjectProgress } from '../../domain/selectors';
import { StatusBadge } from '../../components/StatusBadge';

export function ProductList({ state, navigate }: { state: DomainState; navigate: (route: string) => void }) {
  const actor = { userId: 'user-enterprise-owner', organizationId: 'org-enterprise-wenzhou', projectIds: ['project-wenzhou'], role: 'enterprise_owner' as const };
  return <div className="page-stack"><div className="page-intro"><div><span className="eyebrow">业务数据 / 商品档案</span><h1>商品经营</h1><p>商品不是一次性内容，而是持续维护的主档、素材、版本、合规和渠道记录。</p></div><button type="button" onClick={() => navigate('/mini-program')}>从小程序发起 →</button></div><div className="product-table"><div className="product-table-head"><span>商品</span><span>生命周期</span><span>内容进度</span><span>合规进度</span><span>渠道进度</span><span /></div>{state.products.map((product) => { const progress = selectObjectProgress(state, 'Product', product.id, actor); return <button className="product-row" key={product.id} type="button" onClick={() => navigate(`/product/${product.id}`)}><div><strong>{product.name}</strong><small>{product.id} · 版本 {product.currentVersion}</small></div><StatusBadge status={progress.lifecycle} /><StatusBadge status={progress.content} /><StatusBadge status={progress.compliance} /><StatusBadge status={progress.channel} /><span className="row-arrow">→</span></button>; })}</div></div>;
}
