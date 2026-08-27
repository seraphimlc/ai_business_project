import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DomainProvider } from './domain/store';
import { SellerApp } from './seller/SellerApp';
import './styles/tokens.css';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DomainProvider><SellerApp /></DomainProvider>
  </StrictMode>,
);
