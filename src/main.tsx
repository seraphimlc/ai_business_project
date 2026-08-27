import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DomainProvider } from './domain/store';
import './styles/tokens.css';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DomainProvider><App /></DomainProvider>
  </StrictMode>,
);
