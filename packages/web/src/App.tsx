// Application shell: routes, shared header and footer.

import { lazy, Suspense, useEffect } from 'react';
import { seed, useResource, type Info, type Package } from './api.ts';
import { FitHelper } from './components/FitHelper.tsx';
import { Header } from './components/Header.tsx';
import { Hero } from './components/Hero.tsx';
import { PackagePage } from './components/PackagePage.tsx';
import { Catalog, Footer, VerifySection, Why } from './components/Sections.tsx';
import { useI18n } from './i18n.tsx';
import { Link, useRoute } from './router.tsx';
import { useTheme } from './theme.ts';

// The control room is only for the operator: keep it out of the public bundle.
const AdminPage = lazy(() => import('./admin/AdminPage.tsx').then((m) => ({ default: m.AdminPage })));

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="wrap" style={{ paddingBlock: '4rem' }}>
      <div className="state">
        <h1 className="state-title">404</h1>
        <p>{t.page.notFoundBody}</p>
        <Link className="btn btn-sm" href="/">{t.page.back}</Link>
      </div>
    </div>
  );
}

export function App() {
  const { t } = useI18n();
  const route = useRoute();
  const [theme, setTheme] = useTheme();
  const info = useResource<Info>('/api/info');
  const packages = useResource<Package[]>(route.name === 'home' ? '/api/packages' : null);

  // Seed package pages from the list so opening one is instant.
  useEffect(() => {
    if (packages.status === 'ok') for (const p of packages.data) seed(`/api/packages/${encodeURIComponent(p.id)}`, p);
  }, [packages.status, packages.data]);

  return (
    <>
      <a className="skip-link" href="#main">{t.skip}</a>
      <Header theme={theme} onTheme={setTheme} variant={route.name === 'admin' ? 'admin' : 'public'} />
      <main id="main" tabIndex={-1}>
        {route.name === 'home' && (
          <>
            <Hero info={info} />
            <FitHelper />
            <Catalog packages={packages} />
            <VerifySection />
            <Why />
          </>
        )}
        {route.name === 'package' && <PackagePage key={route.id} id={route.id} />}
        {route.name === 'admin' && (
          <Suspense fallback={<div className="wrap" style={{ paddingBlock: '3rem' }}>{t.state.loading}</div>}>
            <AdminPage info={info} />
          </Suspense>
        )}
        {route.name === 'notFound' && <NotFound />}
      </main>
      <Footer info={info} />
    </>
  );
}
