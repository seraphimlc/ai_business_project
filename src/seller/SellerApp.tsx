import { useEffect, useState } from 'react';
import { useDomainStore } from '../domain/store';
import { SellerShell } from './SellerShell';
import { SellerHome } from './pages/SellerHome';
import { ListingGenerator } from './pages/listing';
import { SourcingAnalysis } from './pages/sourcing';
import { ComplianceAssistant } from './pages/compliance';
import { AdsAssistant } from './pages/ads';
import { LkbStudio } from '../pages/LkbStudio';
import { ToastProvider } from '../h5/components';

function routeFromLocation() { return window.location.pathname.replace(/\/$/, '') || '/'; }

export function SellerApp() {
  const { state, reset, hydrationNotice } = useDomainStore();
  const [route, setRoute] = useState(routeFromLocation);
  useEffect(() => { const onPopState = () => setRoute(routeFromLocation()); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState); }, []);
  const navigate = (next: string) => { window.history.pushState({}, '', next); setRoute(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const content = route === '/' ? <SellerHome navigate={navigate} state={state} /> : route.startsWith('/listing') ? <ListingGenerator navigate={navigate} /> : route === '/lkb' ? <LkbStudio /> : route === '/sourcing' ? <SourcingAnalysis /> : route === '/compliance' ? <ComplianceAssistant /> : route === '/ads' ? <AdsAssistant /> : <SellerHome navigate={navigate} state={state} />;
  return <ToastProvider><SellerShell route={route} navigate={navigate} onReset={reset}><>{hydrationNotice && <div className="global-notice" role="status">{hydrationNotice}</div>}{content}</></SellerShell></ToastProvider>;
}
