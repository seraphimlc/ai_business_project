import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { useDomainStore } from './domain/store';
import { ScenarioDetail } from './pages/ScenarioDetail';
import { ScenarioCatalog } from './pages/ScenarioCatalog';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { WorkspaceHome } from './pages/WorkspaceHome';
import { ProductArchitecture } from './pages/architecture/ProductArchitecture';
import { SystemArchitecture } from './pages/architecture/SystemArchitecture';
import { BusinessObjectMap } from './pages/architecture/BusinessObjectMap';
import { ProductList } from './pages/product/ProductList';
import { ProductWorkspace } from './pages/product/ProductWorkspace';
import { MiniProgramPreview } from './pages/product/MiniProgramPreview';
import { LeadFlow } from './pages/flows/LeadFlow';
import { ComplianceFlow } from './pages/flows/ComplianceFlow';
import { QuotationFlow } from './pages/flows/QuotationFlow';
import { OrderFlow } from './pages/flows/OrderFlow';

function routeFromLocation() { return window.location.pathname.replace(/\/$/, '') || '/'; }

export default function App() {
  const { state, reset, hydrationNotice } = useDomainStore();
  const [route, setRoute] = useState(routeFromLocation);
  useEffect(() => { const onPopState = () => setRoute(routeFromLocation()); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState); }, []);
  const navigate = (next: string) => { window.history.pushState({}, '', next); setRoute(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const content = route === '/' ? <WorkspaceHome navigate={navigate} state={state} /> : route === '/catalog' ? <ScenarioCatalog navigate={navigate} /> : route.startsWith('/catalog/') ? <ScenarioDetail id={route.split('/')[2]} navigate={navigate} /> : route === '/architecture/product' ? <ProductArchitecture navigate={navigate} /> : route === '/architecture/system' ? <SystemArchitecture navigate={navigate} /> : route === '/architecture/objects' ? <BusinessObjectMap navigate={navigate} /> : route === '/product' ? <ProductList state={state} navigate={navigate} /> : route.startsWith('/product/') ? <ProductWorkspace id={route.split('/')[2]} navigate={navigate} /> : route === '/mini-program' ? <MiniProgramPreview navigate={navigate} /> : route === '/leads' ? <LeadFlow navigate={navigate} /> : route === '/compliance' ? <ComplianceFlow navigate={navigate} /> : route === '/quotation' ? <QuotationFlow navigate={navigate} /> : route === '/order' ? <OrderFlow navigate={navigate} /> : <PlaceholderPage kind={route === '/tasks' ? 'tasks' : route === '/data' ? 'data' : route === '/analytics' ? 'analytics' : 'tasks'} state={state} navigate={navigate} />;
  return <AppShell route={route} navigate={navigate} onReset={reset}><>{hydrationNotice && <div className="global-notice" role="status">{hydrationNotice}</div>}{content}</></AppShell>;
}
