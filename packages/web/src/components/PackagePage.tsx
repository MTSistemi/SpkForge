// Package page: identity, setup-guide call-out, versions table, changelog, verify.

import { useEffect } from 'react';
import { useResource, type Localized, type Package, type PackageVersion } from '../api.ts';
import { dsmShort, FAMILY_ORDER, formatBytes, shortHash } from '../format.ts';
import { useI18n } from '../i18n.tsx';
import { Link } from '../router.tsx';
import { CopyButton } from './CopyButton.tsx';
import { IconArrowLeft, IconArrowRight, IconBook, IconDownload, IconExternal, IconLifebuoy } from './Icons.tsx';
import { ErrorState, Loading, Skeleton } from './States.tsx';
import { FamilyChips, VerifyCommands } from './Sections.tsx';
import './PackagePage.css';

/** Extra words for the setup call-out, where a package needs something specific. */
const SETUP_NOTES: Record<string, Localized> = {
  'zt-syno-net': {
    enu: "zt-syno-net needs a boot-up task run as root, created once in Control Panel → Task Scheduler: it loads tun and gives ZeroTier the network rights it needs. Run it again after every upgrade.",
    ita: "zt-syno-net richiede un’attività all’avvio eseguita come root, da creare una volta in Pannello di controllo → Utilità di pianificazione: carica tun e dà a ZeroTier i permessi di rete che gli servono. Va rieseguita dopo ogni aggiornamento.",
  },
};

function groupByVersion(versions: PackageVersion[]): { version: string; files: PackageVersion[] }[] {
  const groups = new Map<string, PackageVersion[]>();
  for (const v of versions) groups.set(v.version, [...(groups.get(v.version) ?? []), v]);
  const rank = (v: PackageVersion) => FAMILY_ORDER.indexOf(v.families[0] ?? 'noarch');
  return [...groups.entries()].map(([version, files]) => ({ version, files: files.sort((a, b) => rank(a) - rank(b)) }));
}

function PackageSkeleton() {
  return (
    <Loading>
      <div className="wrap pkgpage-skel">
        <Skeleton width="6rem" height="6rem" />
        <div className="pkg-skel-lines">
          <Skeleton width="50%" height="2.4rem" />
          <Skeleton width="85%" />
          <Skeleton width="65%" />
        </div>
      </div>
    </Loading>
  );
}

export function PackagePage({ id }: { id: string }) {
  const { t, pick } = useI18n();
  const pkg = useResource<Package>(`/api/packages/${encodeURIComponent(id)}`);

  useEffect(() => {
    document.title = pkg.status === 'ok' ? `${pick(pkg.data.name)} — SpkForge` : 'SpkForge';
    return () => { document.title = 'SpkForge — package source for Synology DSM 7'; };
  }, [pkg.status, pkg.data, pick]);

  return (
    <div className="pkgpage">
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/#packages"><IconArrowLeft />{t.page.back}</Link>
        </nav>
      </div>

      {pkg.status === 'loading' && <PackageSkeleton />}
      {pkg.status === 'error' && (
        <div className="wrap">
          {'status' in pkg.error && pkg.error.status === 404 ? (
            <div className="state">
              <h1 className="state-title">{t.page.notFoundTitle}</h1>
              <p>{t.page.notFoundBody}</p>
              <Link className="btn btn-sm" href="/#packages"><IconArrowLeft />{t.page.back}</Link>
            </div>
          ) : (
            <ErrorState onRetry={pkg.reload} />
          )}
        </div>
      )}
      {pkg.status === 'ok' && <PackageBody pkg={pkg.data} />}
    </div>
  );

}

function PackageBody({ pkg: p }: { pkg: Package }) {
  const { t, ...fmt } = useI18n();
  const groups = groupByVersion(p.versions);
  const latest = p.versions.find((v) => v.version === p.latestVersion) ?? p.versions[0];
  const note = SETUP_NOTES[p.id];
  const latestFiles = groups.find((g) => g.version === p.latestVersion)?.files ?? [];

  return (
    <>
      <header className="wrap pkgpage-head">
        <img className="pkgpage-icon" src={p.icon} alt="" width={96} height={96} />
        <div className="pkgpage-id">
          <p className="kicker mono">{p.id}</p>
          <h1 className="pkgpage-title">{fmt.pick(p.name)}</h1>
          <p className="pkgpage-desc">{fmt.pick(p.description)}</p>
          <div className="pkgpage-links">
            {p.helpUrl && <a className="btn btn-sm" href={p.helpUrl} rel="noopener noreferrer"><IconBook />{t.page.guide}</a>}
            {p.supportUrl && <a className="btn btn-sm" href={p.supportUrl} rel="noopener noreferrer"><IconLifebuoy />{t.page.support}</a>}
          </div>
        </div>
        <dl className="pkgpage-facts">
          <div><dt>{t.page.latest}</dt><dd className="mono">{p.latestVersion}</dd></div>
          <div><dt>{t.page.dsmMin}</dt><dd className="mono">{latest ? dsmShort(latest.osMinVer) : '—'}</dd></div>
          <div><dt>{t.page.downloads}</dt><dd className="tabular">{fmt.number(p.downloads)}</dd></div>
          <div>
            <dt>{t.page.maintainer}</dt>
            <dd>{p.maintainerUrl ? <a href={p.maintainerUrl} rel="noopener noreferrer">{p.maintainer}</a> : p.maintainer}</dd>
          </div>
          <div className="pkgpage-fam"><dt>{t.page.cpus}</dt><dd><FamilyChips families={p.families} /></dd></div>
        </dl>
      </header>

      {p.helpUrl && (
        <div className="wrap">
          <aside className="callout" aria-labelledby="guide-callout">
            <IconBook className="callout-icon" />
            <div>
              <h2 id="guide-callout" className="callout-title">{t.page.guideCalloutTitle}</h2>
              <p>{note ? fmt.pick(note) : t.page.guideCalloutBody}</p>
            </div>
            <a className="btn btn-primary" href={p.helpUrl} rel="noopener noreferrer">
              {t.page.guideCta}<IconExternal />
            </a>
          </aside>
        </div>
      )}

      <section className="section pkgpage-versions" aria-labelledby="versions-title">
        <div className="wrap">
          <div className="section-head">
            <h2 id="versions-title" className="h2">{t.page.versions}</h2>
            <p className="lead">{t.page.versionsLead}</p>
          </div>
          <div className="vtable-wrap">
            <table className="vtable">
              <thead>
                <tr>
                  <th scope="col">{t.page.colFamily}</th>
                  <th scope="col">{t.page.colChannel}</th>
                  <th scope="col" className="vdsm">{t.page.colDsm}</th>
                  <th scope="col" className="num">{t.page.colSize}</th>
                  <th scope="col">{t.page.colSha}</th>
                  <th scope="col" className="num vdl">{t.page.colDownloads}</th>
                  <th scope="col"><span className="visually-hidden">{t.page.colGet}</span></th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.version}>
                  <tr className="vgroup">
                    <th scope="rowgroup" colSpan={7}>
                      <span className="mono vgroup-version">{group.version}</span>
                      {group.version === p.latestVersion && <span className="badge badge-stable">{t.page.latest}</span>}
                      <span className="vgroup-count">{t.page.files(group.files.length)}</span>
                    </th>
                  </tr>
                  {group.files.map((v) => (
                    <tr key={v.fileName}>
                      <td data-label={t.page.colFamily}>
                        <span className="vfam">{v.families.map((f) => t.families[f]).join(', ') || '—'}</span>
                        <span className="vfile mono" translate="no">{v.fileName}</span>
                        <span className="vplat" title={v.arch.join(' ')}>{t.page.platforms(v.arch.filter((a) => !FAMILY_ORDER.includes(a as never)).length || 1)}</span>
                      </td>
                      <td data-label={t.page.colChannel}>
                        <span className={`badge badge-${v.channel}`}>{t.channel[v.channel]}</span>
                          <span className="vch-dsm mono" aria-hidden="true">DSM {dsmShort(v.osMinVer)}</span>
                      </td>
                      <td data-label={t.page.colDsm} className="mono vdsm">{dsmShort(v.osMinVer)}</td>
                      <td data-label={t.page.colSize} className="num tabular">{formatBytes(v.size, fmt.lang)}</td>
                      <td data-label={t.page.colSha}>
                        <span className="vsha">
                          <code title={v.sha256} translate="no">{shortHash(v.sha256)}</code>
                          <CopyButton text={v.sha256} compact label={`${t.copy.copyFull}: SHA-256 ${v.fileName}`} />
                        </span>
                      </td>
                      <td data-label={t.page.colDownloads} className="num tabular vdl">{fmt.number(v.downloads)}</td>
                      <td className="vget">
                        <a className="btn btn-sm" href={v.download} download={v.fileName} title={`${t.page.download} ${v.fileName}`}>
                          <IconDownload /><span className="vget-label">{t.page.download}</span>
                          <span className="visually-hidden"> {v.fileName}</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          <div className="pkgpage-lower">
            <section className="changelog" aria-labelledby="changelog-title">
              <h2 id="changelog-title" className="h3">{t.page.changelog}</h2>
              <ol className="changelog-list">
                {groups.map((group) => {
                  const text = fmt.pick(group.files[0]?.changelog);
                  return (
                    <li key={group.version}>
                      <span className="mono changelog-version">{group.version}</span>
                      <p>{text || t.page.noChangelog}</p>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section id="verify" className="verify-panel" aria-labelledby="pkg-verify-title" tabIndex={-1}>
              <h2 id="pkg-verify-title" className="h3">{t.verify.title}</h2>
              <p className="verify-why">{t.verify.lead}</p>
              <VerifyCommands files={latestFiles} />
            </section>
          </div>

          <p className="pkgpage-more">
            <Link href="/#fit">{t.fit.title}<IconArrowRight /></Link>
          </p>
        </div>
      </section>
    </>
  );
}
