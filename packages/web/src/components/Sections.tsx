// Home page sections below the hero: catalog, verify, why; plus the footer.

import { useId, useState } from 'react';
import type { Family, Info, Package, Resource } from '../api.ts';
import { FAMILY_ORDER } from '../format.ts';
import { useI18n } from '../i18n.tsx';
import { Link } from '../router.tsx';
import { CopyButton } from './CopyButton.tsx';
import { REPO_URL } from './Header.tsx';
import { IconArrowRight, IconDownload, IconGitHub } from './Icons.tsx';
import { Reveal } from './Reveal.tsx';
import { ErrorState, Loading, Skeleton } from './States.tsx';
import './Sections.css';

export function FamilyChips({ families }: { families: Family[] }) {
  const { t } = useI18n();
  const sorted = FAMILY_ORDER.filter((f) => families.includes(f));
  return (
    <ul className="chips">
      {sorted.map((f) => (
        <li key={f} className="chip">{t.families[f]} <span className="mono">{f}</span></li>
      ))}
    </ul>
  );
}

export function Catalog({ packages }: { packages: Resource<Package[]> }) {
  const { t, pick, number } = useI18n();
  return (
    <section id="packages" className="section" aria-labelledby="packages-title" tabIndex={-1}>
      <Reveal className="wrap">
        <div className="section-head">
          <p className="kicker">{t.pkgs.kicker}</p>
          <h2 id="packages-title" className="h2">{t.pkgs.title}</h2>
          <p className="lead">{t.pkgs.lead}</p>
        </div>

        {packages.status === 'loading' && (
          <Loading>
            <div className="pkg-card pkg-card-skel">
              <Skeleton width="4.5rem" height="4.5rem" />
              <div className="pkg-skel-lines"><Skeleton width="40%" height="1.4rem" /><Skeleton width="90%" /><Skeleton width="70%" /></div>
            </div>
          </Loading>
        )}
        {packages.status === 'error' && <ErrorState onRetry={packages.reload} />}
        {packages.status === 'ok' && packages.data.length === 0 && (
          <div className="state"><p>{t.pkgs.empty}</p></div>
        )}
        {packages.status === 'ok' && packages.data.length > 0 && (
          <ul className="pkg-grid">
            {packages.data.map((pkg) => (
              <li key={pkg.id}>
                <article className="pkg-card">
                  <img className="pkg-icon" src={pkg.icon} alt="" width={72} height={72} loading="lazy" />
                  <div className="pkg-main">
                    <header className="pkg-head">
                      <h3 className="pkg-name">
                        <Link href={`/p/${encodeURIComponent(pkg.id)}`} className="pkg-link">{pick(pkg.name)}</Link>
                      </h3>
                      <span className="pkg-version"><span className="pkg-version-label">{t.pkgs.latest}</span> <span className="mono">{pkg.latestVersion}</span></span>
                      {pkg.hasBeta && <span className="badge badge-beta">{t.pkgs.beta}</span>}
                    </header>
                    <p className="pkg-desc">{pick(pkg.description)}</p>
                    <FamilyChips families={pkg.families} />
                  </div>
                  <footer className="pkg-foot">
                    <span className="pkg-dl tabular"><IconDownload />{number(pkg.downloads)} {t.pkgs.downloads}</span>
                    <span className="pkg-open" aria-hidden="true">{t.pkgs.open}<IconArrowRight /></span>
                  </footer>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </section>
  );
}

interface VerifyFile { fileName: string; sha256: string }

/** The two verification commands; with files, for the chosen file and its expected hash. */
export function VerifyCommands({ files }: { files?: VerifyFile[] }) {
  const { t } = useI18n();
  const selectId = useId();
  const [chosen, setChosen] = useState(0);
  const file = files?.[chosen];
  const name = file?.fileName ?? '<file>.spk';
  const sha = `sha256sum ${name}`;
  const att = `gh attestation verify ${name} --repo MTSistemi/SpkForge`;

  return (
    <div className="verify-cmds">
      {files && files.length > 0 && (
        <div className="verify-pick">
          <label htmlFor={selectId} className="field-label">{t.verify.file}</label>
          <select id={selectId} className="input mono" value={chosen} onChange={(e) => setChosen(Number(e.target.value))}>
            {files.map((f, i) => <option key={f.fileName} value={i}>{f.fileName}</option>)}
          </select>
        </div>
      )}
      <div className="verify-step">
        <h3><span className="verify-num" aria-hidden="true">A</span>{t.verify.hashTitle}</h3>
        <div className="cmd"><code translate="no">{sha}</code><CopyButton text={sha} /></div>
        {file ? (
          <p className="verify-expected">
            <span>{t.verify.expected}</span>
            <code translate="no">{file.sha256}</code>
          </p>
        ) : (
          <p className="verify-note">{t.verify.hashNote}</p>
        )}
      </div>
      <div className="verify-step">
        <h3><span className="verify-num" aria-hidden="true">B</span>{t.verify.attTitle}</h3>
        <div className="cmd"><code translate="no">{att}</code><CopyButton text={att} /></div>
        <p className="verify-note">{t.verify.attNote}</p>
      </div>
    </div>
  );
}

export function VerifySection() {
  const { t } = useI18n();
  return (
    <section id="verify" className="section verify" aria-labelledby="verify-title" tabIndex={-1}>
      <Reveal className="wrap verify-grid">
        <div className="section-head">
          <p className="kicker">{t.verify.kicker}</p>
          <h2 id="verify-title" className="h2">{t.verify.title}</h2>
          <p className="lead">{t.verify.lead}</p>
        </div>
        <VerifyCommands />
      </Reveal>
    </section>
  );
}

export function Why() {
  const { t } = useI18n();
  return (
    <section id="why" className="section why" aria-labelledby="why-title">
      <Reveal className="wrap">
        <div className="why-grid">
          <div className="section-head">
            <p className="kicker">{t.why.kicker}</p>
            <h2 id="why-title" className="h2">{t.why.title}</h2>
            <p className="lead">{t.why.context}</p>
          </div>
          <ol className="why-points">
            {t.why.points.map((point, i) => (
              <li key={point.t}>
                <span className="why-num mono" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <h3>{point.t}</h3>
                <p>{point.d}</p>
              </li>
            ))}
          </ol>
        </div>
        <p className="why-domain">{t.why.domain}</p>
      </Reveal>
    </section>
  );
}

export function Footer({ info }: { info: Resource<Info> }) {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <p className="footer-line">
          <span>© 2026 MTSistemi</span>
          <span aria-hidden="true">·</span>
          <a href={`${REPO_URL}/blob/main/LICENSE`} rel="noopener noreferrer">AGPL-3.0</a>
          <span aria-hidden="true">·</span>
          <a href={REPO_URL} rel="noopener noreferrer" className="footer-gh"><IconGitHub />GitHub</a>
          {info.status === 'ok' && info.data.admin && (
            <>
              <span aria-hidden="true">·</span>
              <Link href="/admin">{t.nav.admin}</Link>
            </>
          )}
        </p>
        <p className="footer-legal">{t.footer.notAffiliated}</p>
      </div>
    </footer>
  );
}
