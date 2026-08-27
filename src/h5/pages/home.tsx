import { useDomainStore } from '../../domain/store';
import { selectMyNotifications, selectMyTasks, selectStallCases, selectStallProducts, selectStallSummary } from '../../domain/selectors';
import { H5Header, StatusBadge, categoryEmoji } from '../components';
import { useH5 } from '../context';
import type { H5PageProps } from '../H5App';

export function StallHome({ navigate }: H5PageProps) {
  const { state } = useDomainStore();
  const { actor } = useH5();
  const summary = selectStallSummary(state, actor);
  const products = selectStallProducts(state, actor);
  const tasks = selectMyTasks(state, actor);
  const cases = selectStallCases(state, actor);
  const notifications = selectMyNotifications(state, actor);
  const stall = state.partyCompanies.find((item) => item.id === 'party-stall');

  const pendingTasks = tasks.filter((item) => !['已完成', '已取消'].includes(item.status));
  const todoCount = summary.pendingCandidates + pendingTasks.length + cases.reduce((acc, item) => acc + item.pendingMaterials, 0) + (summary.openRisks > 0 ? 1 : 0);
  const unread = notifications.filter((item) => item.status !== '已读').length;

  return (
    <>
      <H5Header title={stall?.name ?? '陈记档口'} sub="拍拍照，商品就上架" action={<button className="h5-header-action" onClick={() => navigate('/todos')} style={{ position: 'relative' }}>待处理{todoCount > 0 ? <b className="h5-dot" style={{ right: '-0.4rem', top: '-0.35rem' }}>{todoCount}</b> : null}</button>} />
      <div className="h5-body">
        <section className="h5-section">
          <button className="h5-capture-hero" onClick={() => navigate('/capture')}>
            <span className="h5-capture-icon">📷</span>
            <strong>拍照上新</strong>
            <small>拍商品照，自动生成商品图、场景图和视频</small>
            <span className="h5-capture-arrow">›</span>
          </button>
        </section>

        <section className="h5-section" style={{ marginTop: '-0.3rem' }}>
          <button className="h5-todo-strip" style={{ background: 'var(--h5-card)', border: '1px solid var(--h5-line)' }} onClick={() => navigate('/lkb')}>
            <span>✨</span>
            <span className="h5-row-main"><strong>AI 商品内容工作台</strong><small>服装套图、视频创作、图片编辑</small></span>
            <span className="h5-capture-arrow">›</span>
          </button>
        </section>

        {todoCount > 0 && (
          <section className="h5-section">
            <button className="h5-todo-strip" onClick={() => navigate('/todos')}>
              <span>🔔</span>
              <span className="h5-row-main"><strong>{todoCount} 件事需要处理</strong><small>补充材料、确认内容、完成任务</small></span>
              <span className="h5-capture-arrow">›</span>
            </button>
          </section>
        )}

        <section className="h5-section">
          <div className="h5-section-title">我的商品<small>{products.length} 个</small></div>
          {products.length === 0 ? (
            <div className="h5-card h5-empty"><i>📦</i><span>还没有商品，点上面「拍照上新」开始</span></div>
          ) : (
            <div className="h5-rail">
              {products.map((product) => {
                const listing = state.channelListings.find((item) => item.productId === product.id && item.status === '已发布');
                const risk = state.complianceCases.find((item) => item.subjectType === 'Product' && item.subjectId === product.id);
                return (
                  <button key={product.id} className="h5-product" style={{ textAlign: 'left' }} onClick={() => navigate(`/product/${product.id}`)}>
                    <div className="h5-thumb"><i>{categoryEmoji(product.category)}</i></div>
                    <div className="h5-product-info">
                      <strong>{product.name}</strong>
                      <span className="h5-unit">{product.price !== undefined ? `¥${product.price} / ${product.unit ?? '件'}` : '未定价'}</span>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        {listing ? <span className="h5-badge positive">已发布</span> : <StatusBadge status={product.status} />}
                        {risk && !['已归档', '已关闭'].includes(risk.status) && <span className="h5-badge danger">需处理</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {unread > 0 && (
          <section className="h5-section">
            <div className="h5-section-title">最新通知</div>
            {notifications.slice(0, 2).map((item) => (
              <div key={item.id} className="h5-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/todos')}>
                <div className="h5-row-main"><strong>{item.title}</strong><span>{item.createdAt.replace('T', ' ').slice(0, 16)}</span></div>
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
