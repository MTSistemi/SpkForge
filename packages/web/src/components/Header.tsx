// Sticky header: mark, section anchors, GitHub, language and theme switches.

import type { ReactElement } from 'react';
import { useI18n, type Lang } from '../i18n.tsx';
import { Link } from '../router.tsx';
import type { ThemeChoice } from '../theme.ts';
import { Glyph } from './Glyph.tsx';
import { IconGitHub, IconMonitor, IconMoon, IconSun } from './Icons.tsx';
import './Header.css';

export const REPO_URL = 'https://github.com/MTSistemi/SpkForge';

interface HeaderProps {
  theme: ThemeChoice;
  onTheme(choice: ThemeChoice): void;
  /** Admin pages show their own nav instead of the public anchors. */
  variant?: 'public' | 'admin';
}

export function Header({ theme, onTheme, variant = 'public' }: HeaderProps) {
  const { t, lang, setLang } = useI18n();
  const langs: { id: Lang; label: string; name: string }[] = [
    { id: 'it', label: 'IT', name: 'Italiano' },
    { id: 'en', label: 'EN', name: 'English' },
  ];
  const themes: { id: ThemeChoice; label: string; icon: ReactElement }[] = [
    { id: 'light', label: t.theme.light, icon: <IconSun /> },
    { id: 'dark', label: t.theme.dark, icon: <IconMoon /> },
    { id: 'system', label: t.theme.system, icon: <IconMonitor /> },
  ];

  return (
    <>
    <header className="site-header">
      <div className="wrap header-bar">
        <Link href="/" className="wordmark" aria-label="SpkForge — home">
          <Glyph className="wordmark-glyph" />
          <span className="wordmark-text">Spk<span>Forge</span></span>
          {variant === 'admin' && <span className="wordmark-tag">admin</span>}
        </Link>

        {variant === 'public' && (
          <nav className="header-nav" aria-label="SpkForge">
            <Link href="/#packages">{t.nav.packages}</Link>
            <Link href="/#add">{t.nav.add}</Link>
            <Link href="/#verify">{t.nav.verify}</Link>
          </nav>
        )}

        <div className="header-tools">
          <a className="icon-btn" href={REPO_URL} rel="noopener noreferrer" aria-label={t.nav.github} title={t.nav.github}>
            <IconGitHub />
          </a>
          <div className="seg" role="group" aria-label={t.langLabel}>
            {langs.map((l) => (
              <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} aria-label={l.name} onClick={() => setLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <div className="seg seg-icons" role="group" aria-label={t.theme.label}>
            {themes.map((th) => (
              <button key={th.id} type="button" aria-pressed={theme === th.id} aria-label={th.label} title={th.label} onClick={() => onTheme(th.id)}>
                {th.icon}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
    {/* Narrow screens: section links in their own row that scrolls away,
        so only the slim top bar stays pinned. */}
    {variant === 'public' && (
      <nav className="header-nav-mobile" aria-label="SpkForge">
        <div className="wrap">
          <Link href="/#add">{t.nav.add}</Link>
          <Link href="/#packages">{t.nav.packages}</Link>
          <Link href="/#verify">{t.nav.verify}</Link>
        </div>
      </nav>
    )}
    </>
  );
}
