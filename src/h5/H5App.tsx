import { useCallback, useEffect, useState } from 'react';
import { useDomainStore } from '../domain/store';
import { H5ErrorBoundary, ToastProvider } from './components';
import { ACTOR } from './actors';
import { H5Context } from './context';
import { StallHome } from './pages/home';
import { ProductGrid } from './pages/products';
import { CaptureFlow } from './pages/capture';
import { ProductDetail } from './pages/productDetail';
import { TodoList } from './pages/tasks';
import { LkbStudio } from './pages/lkbStudio';
import { Mine } from './pages/profile';

export function parseHash(): string {
  const raw = window.location.hash.replace(/^#/, '');
  return raw || '/home';
}

export function useHashRoute(): [string, (next: string) => void] {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onHashChange = () => { setRoute(parseHash()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const navigate = useCallback((next: string) => { window.location.hash = next; }, []);
  return [route, navigate];
}

export interface H5PageProps { navigate: (to: string) => void; }

const TABS = [
  { path: '/home', label: '首页', icon: '🏠' },
  { path: '/products', label: '商品', icon: '📦' },
  { path: '/mine', label: '我的', icon: '👤' },
];

function activeTabFor(path: string) {
  return TABS.find((tab) => path === tab.path || path.startsWith(`${tab.path}/`) || path === '/capture' || path.startsWith('/product/') || path === '/todos');
}

export function H5App() {
  const [route, navigate] = useHashRoute();
  const { reset } = useDomainStore();
  const actor = ACTOR;

  const path = route.split('?')[0];
  const segments = path.split('/').filter(Boolean);
  const active = activeTabFor(path);

  const page = (() => {
    if (path === '/home' || path === '/') return <StallHome navigate={navigate} />;
    if (path === '/capture') return <CaptureFlow navigate={navigate} />;
    if (path === '/products') return <ProductGrid navigate={navigate} />;
    if (segments[0] === 'product' && segments[1]) return <ProductDetail id={segments[1]} navigate={navigate} />;
    if (path === '/todos') return <TodoList navigate={navigate} />;
    if (path === '/lkb') return <LkbStudio navigate={navigate} />;
    if (path === '/mine') return <Mine navigate={navigate} />;
    return <StallHome navigate={navigate} />;
  })();

  const isFullscreen = path === '/lkb';

  return (
    <H5ErrorBoundary onReset={reset}>
      <ToastProvider>
        <H5Context.Provider value={{ role: 'stall-owner', actor }}>
          <div className="h5-app">
            <div className="h5-page" style={isFullscreen ? { padding: 0 } : undefined}>{page}</div>
            {!isFullscreen && (
              <nav className="h5-tabbar" aria-label="主导航">
                {TABS.map((tab) => (
                  <button key={tab.path} className={`h5-tab ${active?.path === tab.path ? 'is-active' : ''}`} onClick={() => navigate(tab.path)}>
                    <i>{tab.icon}</i><span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            )}
          </div>
        </H5Context.Provider>
      </ToastProvider>
    </H5ErrorBoundary>
  );
}
