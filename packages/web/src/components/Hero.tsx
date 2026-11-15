// Home header: what this is, the source address, the three DSM steps, the package properties.

import { useState } from 'react';
import type { Info, Resource } from '../api.ts';
import { useI18n } from '../i18n.tsx';
import { CopyButton } from './CopyButton.tsx';
import { Glyph } from './Glyph.tsx';
import { IconNoClock, IconNoKey, IconProvenance, IconStandalone } from './Icons.tsx';
import { Skeleton } from './States.tsx';
import './Hero.css';

function SplitUrl({ url }: { url: string }) {
  const match = /^(https?:\/\/)(.*)$/.exec(url);
  if (!match) return <>{url}</>;
  return (
    <>
      <span className="plate-scheme">{match[1]}</span>
      <wbr />
      <span className="plate-host">{match[2]}</span>
    </>
  );
}

export function SourcePlate({ info }: { info: Resource<Info> }) {
  const { t } = useI18n();
  const [heat, setHeat] = useState(0);
  const fallback = `${location.origin}/`;
  const source = info.status === 'ok' ? info.data.source : info.status === 'error' ? fallback : null;

  return (
    <figure className="plate" aria-labelledby="plate-label">
      <span className="screw tl" aria-hidden="true" />
      <span className="screw tr" aria-hidden="true" />
      <span className="screw bl" aria-hidden="true" />
      <span className="screw br" aria-hidden="true" />

      <div className="plate-top">
        <span id="plate-label" className="plate-label">{t.hero.plateLabel}</span>
        <span className="plate-rule" aria-hidden="true" />
        <span className="plate-min">{t.hero.plateMin}</span>
      </div>

      <div className="plate-body">
        <Glyph className="plate-mark" strike strikeKey={heat} />
        {source === null ? (
          <span className="plate-url" aria-busy="true"><Skeleton width="min(26rem, 100%)" height="2.1rem" /></span>
        ) : (
          <code className="plate-url" key={heat} data-hot={heat > 0 || undefined} translate="no">
            <SplitUrl url={source} />
          </code>
        )}
        {source !== null && (
          <CopyButton text={source} className="btn-primary plate-copy" onCopied={() => setHeat((h) => h + 1)} />
        )}
      </div>

      <figcaption className="plate-hint">
        {info.status === 'error' ? t.hero.plateFallback : t.hero.plateHint}
      </figcaption>
    </figure>
  );
}

export function Hero({ info }: { info: Resource<Info> }) {
  const { t } = useI18n();
  const source = info.status === 'ok' ? info.data.source : `${location.origin}/`;
  const trustIcons = [IconNoClock, IconNoKey, IconStandalone, IconProvenance];

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap">
        <div className="hero-head">
          <p className="kicker">{t.hero.eyebrow}</p>
          <h1 id="hero-title" className="hero-title">{t.hero.title}</h1>
          <p className="hero-lead">{t.hero.lead}</p>
        </div>

        <div id="add" className="hero-add" tabIndex={-1}>
          <SourcePlate info={info} />

          <div className="steps-block">
            <div className="steps-head">
              <h2 className="steps-title">{t.steps.title}</h2>
              <p className="dsm-path" aria-label={t.steps.path.join(' → ')}>
                {t.steps.path.map((part, i) => (
                  <span key={part}>
                    {i > 0 && <span className="dsm-sep" aria-hidden="true">›</span>}
                    <span className="dsm-crumb">{part}</span>
                  </span>
                ))}
              </p>
            </div>
            <ol className="steps">
              <li>
                <span className="step-num" aria-hidden="true">01</span>
                <h3>{t.steps.s1t}</h3>
                <p>{t.steps.s1d}</p>
              </li>
              <li>
                <span className="step-num" aria-hidden="true">02</span>
                <h3>{t.steps.s2t}</h3>
                <p>{t.steps.s2d}</p>
              </li>
              <li>
                <span className="step-num" aria-hidden="true">03</span>
                <h3>{t.steps.s3t}</h3>
                <dl className="step-fields">
                  <div>
                    <dt>{t.steps.s3name}</dt>
                    <dd><code>SpkForge</code><CopyButton text="SpkForge" compact label={`${t.copy.copy}: SpkForge`} /></dd>
                  </div>
                  <div>
                    <dt>{t.steps.s3loc}</dt>
                    <dd><code translate="no">{source}</code><CopyButton text={source} compact label={`${t.copy.copy}: ${source}`} /></dd>
                  </div>
                </dl>
                <p>{t.steps.s3d}</p>
              </li>
            </ol>
            <p className="steps-note">{t.steps.note}</p>
          </div>
        </div>

        <ul className="trust" aria-label={t.trust.label}>
          {t.trust.items.map((item, i) => {
            const Icon = trustIcons[i] ?? IconProvenance;
            return (
              <li key={item}>
                <Icon />
                <span>{item}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
