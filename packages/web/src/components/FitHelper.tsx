// "What fits my NAS": platform + channel (+ optional DSM build) → the exact
// catalog Package Center would receive, from /api/preview.

import { useEffect, useId, useState } from 'react';
import { useResource, type Channel, type Platform, type PreviewEntry } from '../api.ts';
import { formatBytes } from '../format.ts';
import { useI18n } from '../i18n.tsx';
import { Link } from '../router.tsx';
import { IconArrowRight, IconDownload } from './Icons.tsx';
import { PlatformPicker } from './PlatformPicker.tsx';
import { ErrorState, Loading, Skeleton } from './States.tsx';
import './FitHelper.css';

const STORAGE_KEY = 'spkforge.fit';

interface Saved { platform: string; channel: Channel }

function loadSaved(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Saved>;
    return { platform: typeof raw.platform === 'string' ? raw.platform : '', channel: raw.channel === 'beta' ? 'beta' : 'stable' };
  } catch {
    return { platform: '', channel: 'stable' };
  }
}

function fileOf(link: string): string {
  try {
    const path = new URL(link, location.href).pathname;
    return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
  } catch {
    return link;
  }
}

export function FitHelper() {
  const { t, lang, dsmLang } = useI18n();
  const platformLabel = useId();
  const [saved] = useState(loadSaved);
  const [platform, setPlatform] = useState(saved.platform);
  const [channel, setChannel] = useState<Channel>(saved.channel);
  const [build, setBuild] = useState('');

  const platforms = useResource<Platform[]>('/api/platforms');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ platform, channel }));
    } catch {
      // Not persisted.
    }
  }, [platform, channel]);

  const validBuild = /^\d{4,6}$/.test(build) ? build : '';
  const query = new URLSearchParams({ platform, channel, language: dsmLang });
  if (validBuild) query.set('build', validBuild);
  const preview = useResource<{ packages: PreviewEntry[] }>(platform ? `/api/preview?${query}` : null);
  const known = platforms.status === 'ok' ? platforms.data.find((p) => p.platform === platform) : undefined;

  return (
    <section id="fit" className="section fit" aria-labelledby="fit-title" tabIndex={-1}>
      <div className="wrap">
        <div className="section-head">
          <p className="kicker">{t.fit.kicker}</p>
          <h2 id="fit-title" className="h2">{t.fit.title}</h2>
          <p className="lead">{t.fit.lead}</p>
        </div>

        <div className="fit-grid">
          <form className="fit-controls" onSubmit={(e) => e.preventDefault()}>
            <div className="field">
              <span id={platformLabel} className="field-label">{t.fit.platform}</span>
              {platforms.status === 'ok' ? (
                <PlatformPicker platforms={platforms.data} value={known ? platform : ''} onChange={setPlatform} labelId={platformLabel} />
              ) : platforms.status === 'error' ? (
                <ErrorState onRetry={platforms.reload} />
              ) : (
                <Skeleton height="2.75rem" />
              )}
            </div>

            <div className="field-row">
              {/* A labelled group rather than fieldset/legend: legends sit on the
                  border and never line up with the label next to them. */}
              <div className="field" role="group" aria-labelledby="fit-channel-label">
                <span id="fit-channel-label" className="field-label">{t.fit.channel}</span>
                <div className="seg seg-wide">
                  {(['stable', 'beta'] as const).map((c) => (
                    <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)}>
                      {t.channel[c]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span className="field-label">
                  {t.fit.build} <span className="field-optional">· {t.fit.buildOptional}</span>
                </span>
                <input
                  className="input mono"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="72806"
                  value={build}
                  onChange={(e) => setBuild(e.target.value.replace(/\D/g, ''))}
                  aria-describedby="fit-build-hint"
                />
              </label>
            </div>
            <p id="fit-build-hint" className="field-hint">{t.fit.buildHint}</p>

            <details className="fit-how">
              <summary>{t.fit.howTitle}</summary>
              <p>{t.fit.how}</p>
              <p className="mono fit-examples">{t.fit.examples}</p>
            </details>
          </form>

          <div className="fit-result" aria-live="polite" aria-busy={preview.status === 'loading' && platform !== ''}>
            <div className="fit-result-head">
              <span>{t.fit.resultTitle}</span>
              {platform && (
                <span className="mono fit-query" translate="no">
                  arch={platform} · {channel}{validBuild ? ` · build=${validBuild}` : ''}
                </span>
              )}
            </div>

            {!platform ? (
              <p className="fit-empty">{t.fit.pickFirst}</p>
            ) : preview.status === 'loading' ? (
              <Loading>
                <div className="fit-entry">
                  <Skeleton width="3rem" height="3rem" />
                  <div className="fit-skel"><Skeleton width="45%" /><Skeleton width="80%" height="0.8rem" /><Skeleton width="60%" height="0.8rem" /></div>
                </div>
              </Loading>
            ) : preview.status === 'error' ? (
              <ErrorState onRetry={preview.reload} />
            ) : preview.data.packages.length === 0 ? (
              <div className="fit-empty">
                <p className="fit-none">{channel === 'beta' ? t.fit.noneBeta : t.fit.none}</p>
                <p>{t.fit.noneHint}</p>
              </div>
            ) : (
              <>
                <p className="fit-count">{t.fit.count(preview.data.packages.length)}</p>
                <ul className="fit-list">
                  {preview.data.packages.map((entry) => {
                    const file = fileOf(entry.link);
                    return (
                      <li key={entry.package} className="fit-entry">
                        <img src={entry.thumbnail[1] ?? entry.thumbnail[0]} alt="" width={48} height={48} className="fit-icon" loading="lazy" />
                        <div className="fit-body">
                          <p className="fit-name">
                            <strong>{entry.dname}</strong>
                            <span className="mono fit-version">{entry.version}</span>
                            {entry.beta && <span className="badge badge-beta">{t.fit.beta}</span>}
                          </p>
                          <dl className="fit-meta">
                            <div className="fit-file"><dt>{t.fit.file}</dt><dd className="mono" translate="no">{file}</dd></div>
                            <div><dt>{t.fit.size}</dt><dd className="tabular">{formatBytes(entry.size, lang)}</dd></div>
                            <div><dt>{t.fit.md5}</dt><dd className="mono">{entry.md5}</dd></div>
                          </dl>
                          <div className="fit-actions">
                            <a className="btn btn-sm" href={entry.link} download={file}><IconDownload />{t.fit.download}</a>
                            <Link className="btn btn-sm btn-ghost" href={`/p/${encodeURIComponent(entry.package)}`}>
                              {t.fit.details}<IconArrowRight />
                            </Link>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
