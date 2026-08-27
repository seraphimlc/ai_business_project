import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DomainProvider } from './domain/store';
import { H5App } from './h5/H5App';
import './styles/tokens.css';
import './styles/global.css';
import './styles/h5.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DomainProvider><H5App /></DomainProvider>
  </StrictMode>,
);
