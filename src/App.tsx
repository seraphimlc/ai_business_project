import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { useDomainStore } from './domain/store';
import { WorkspaceHome } from './pages/WorkspaceHome';
import { ProductList } from './pages/product/ProductList';
import { ProductWorkspace } from './pages/product/ProductWorkspace';
import { LeadFlow } from './pages/flows/LeadFlow';
import { ComplianceFlow } from './pages/flows/ComplianceFlow';
import { QuotationFlow } from './pages/flows/QuotationFlow';
import { OrderFlow } from './pages/flows/OrderFlow';
import { LkbStudio } from './pages/LkbStudio';

function routeFromLocation() { return window.location.pathname.replace(/\/$/, '') || '/'; }

export default function App() {
  const { state, reset, hydrationNotice } = useDomainStore();
  const [route, setRoute] = useState(routeFromLocation);
  useEffect(() => { const onPopState = () => setRoute(routeFromLocation()); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState); }, []);
  const navigate = (next: string) => { window.history.pushState({}, '', next); setRoute(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const content = route === '/' ? <WorkspaceHome navigate={navigate} state={state} /> : route === '/product' ? <ProductList state={state} navigate={navigate} /> : route.startsWith('/product/') ? <ProductWorkspace id={route.split('/')[2]} navigate={navigate} /> : route === '/leads' ? <LeadFlow navigate={navigate} /> : route === '/compliance' ? <ComplianceFlow navigate={navigate} /> : route === '/quotation' ? <QuotationFlow navigate={navigate} /> : route === '/order' ? <OrderFlow navigate={navigate} /> : route === '/lkb' ? <LkbStudio /> : <WorkspaceHome navigate={navigate} state={state} />;
  return <AppShell route={route} navigate={navigate} onReset={reset}><>{hydrationNotice && <div className="global-notice" role="status">{hydrationNotice}</div>}{content}</></AppShell>;
}
