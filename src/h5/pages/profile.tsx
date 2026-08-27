import { useDomainStore } from '../../domain/store';
import { selectStallProducts, selectStallSummary, selectMyTasks } from '../../domain/selectors';
import { H5Header, H5Section } from '../components';
import { useH5 } from '../context';
import type { H5PageProps } from '../H5App';

export function Mine({ navigate }: H5PageProps) {
  const { state, reset } = useDomainStore();
  const { actor } = useH5();
  const stall = state.partyCompanies.find((item) => item.id === 'party-stall');
  const products = selectStallProducts(state, actor);
  const summary = selectStallSummary(state, actor);
  const tasks = selectMyTasks(state, actor);
  const published = products.filter((product) => state.channelListings.some((item) => item.productId === product.id && item.status === '已发布')).length;
  const pendingCount = summary.pendingCandidates + tasks.filter((item) => !['已完成', '已取消'].includes(item.status)).length;

  return (
    <>
      <H5Header title="我的" />
      <div className="h5-body">
        <div className="h5-section">
          <div className="h5-profile-hero">
            <div className="h5-avatar">陈</div>
            <div>
              <strong>{stall?.name ?? '陈记档口'}</strong>
              <span>档口业主 · 已发布 {published} / 共 {products.length} 个商品</span>
            </div>
          </div>
        </div>

        <H5Section title="我的业务">
          <div className="h5-menu">
            <button className="h5-menu-row" onClick={() => navigate('/capture')}><i>📷</i><span>拍照上新</span><b>›</b></button>
            <button className="h5-menu-row" onClick={() => navigate('/products')}><i>📦</i><span>我的商品</span><b>›</b></button>
            <button className="h5-menu-row" onClick={() => navigate('/todos')}><i>🔔</i><span>待处理{pendingCount > 0 ? `（${pendingCount}）` : ''}</span><b>›</b></button>
          </div>
        </H5Section>

        <H5Section title="更多">
          <div className="h5-menu">
            <a className="h5-menu-row" href="https://pc.visitworld.me" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><i>🖥️</i><span>企业 / 平台运营工作台（PC 端）</span><b>↗</b></a>
            <button className="h5-menu-row" onClick={() => reset()}><i>🔄</i><span>重置演示数据</span><b>›</b></button>
          </div>
        </H5Section>

        <p className="h5-footnote">H5 端是档口业主的移动工作台：拍照上新、自动出图、一键发布。<br />批量经营与平台运营请使用 PC 端。两端共享同一套业务数据。</p>
      </div>
    </>
  );
}
