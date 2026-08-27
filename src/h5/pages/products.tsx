import { useState } from 'react';
import { useDomainStore } from '../../domain/store';
import { selectStallProducts } from '../../domain/selectors';
import { H5Header, StatusBadge, categoryEmoji } from '../components';
import { useH5 } from '../context';
import type { H5PageProps } from '../H5App';

export function ProductGrid({ navigate }: H5PageProps) {
  const { state } = useDomainStore();
  const { actor } = useH5();
  const [filter, setFilter] = useState<'全部' | '已发布' | '未发布'>('全部');
  const products = selectStallProducts(state, actor);
  const visible = products.filter((product) => {
    const listing = state.channelListings.find((item) => item.productId === product.id && item.status === '已发布');
    if (filter === '已发布') return Boolean(listing);
    if (filter === '未发布') return !listing;
    return true;
  });

  return (
    <>
      <H5Header title="我的商品" sub={`${products.length} 个`} action={<button className="h5-header-action" onClick={() => navigate('/capture')}>＋ 拍照上新</button>} />
      <div className="h5-body">
        <div className="h5-chips" style={{ marginBottom: '0.7rem' }}>
          {(['全部', '已发布', '未发布'] as const).map((item) => <button key={item} className={`h5-chip ${filter === item ? 'is-active' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        {visible.length === 0 ? (
          <div className="h5-card h5-empty"><i>📦</i><span>这里还没有商品<br />点「拍照上新」，拍张照就能上架</span></div>
        ) : (
          <div className="h5-product-grid">
            {visible.map((product) => {
              const listing = state.channelListings.find((item) => item.productId === product.id && item.status === '已发布');
              const risk = state.complianceCases.find((item) => item.subjectType === 'Product' && item.subjectId === product.id);
              const assetCount = state.productAssets.filter((item) => item.productId === product.id).length;
              return (
                <button key={product.id} className="h5-product" style={{ textAlign: 'left' }} onClick={() => navigate(`/product/${product.id}`)}>
                  <div className="h5-thumb" style={{ height: 150 }}><i>{categoryEmoji(product.category)}</i></div>
                  <div className="h5-product-info">
                    <strong>{product.name}</strong>
                    <span className="h5-price">{product.price !== undefined ? <><small>¥</small>{product.price}</> : '未定价'}</span>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {listing ? <span className="h5-badge positive">已发布</span> : <StatusBadge status={product.status} />}
                      {risk && !['已归档', '已关闭'].includes(risk.status) && <span className="h5-badge danger">需处理</span>}
                      <span className="h5-unit">{assetCount} 图</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div style={{ margin: '0.9rem 0 1rem' }}>
          <button className="h5-btn primary block" onClick={() => navigate('/capture')}>📷 拍照上新</button>
        </div>
      </div>
    </>
  );
}
