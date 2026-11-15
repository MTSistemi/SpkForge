// Entry point. No inline scripts anywhere: the server's CSP forbids them, so
// the stored theme is applied here, before the first render.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Global styles first, so component stylesheets come later in the cascade.
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './App.tsx';
import { I18nProvider } from './i18n.tsx';
import { applyTheme, storedTheme } from './theme.ts';

applyTheme(storedTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
