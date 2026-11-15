// Admin control room: sign-in, upload, published files, rejected files,
// download statistics, maintenance. Loaded lazily from App.

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent, type RefObject } from 'react';
import { ApiError, getJson, invalidate, type Info, type Package, type PackageVersion, type Resource } from '../api.ts';
import { CopyButton } from '../components/CopyButton.tsx';
import {
  IconAlert, IconCheck, IconFile, IconKey, IconLogout, IconRefresh, IconUpload, IconX,
} from '../components/Icons.tsx';
import { ErrorState, Skeleton } from '../components/States.tsx';
import { dsmShort, formatBytes, formatDate, shortHash } from '../format.ts';
import { useI18n } from '../i18n.tsx';
import { Link } from '../router.tsx';
import { admin, readToken, SPK_FILE_NAME, storeToken, uploadSpk, type Problem, type ReindexResult, type RejectedFile, type Stats } from './adminApi.ts';
import './Admin.css';

type Toast = { id: number; kind: 'ok' | 'bad'; text: string };

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.status ? `${error.status} ${error.message}` : error.message;
  return error instanceof Error ? error.message : String(error);
}

/* ------------------------------------------------------------------ */

export function AdminPage({ info }: { info: Resource<Info> }) {
  const { t } = useI18n();
  const [token, setToken] = useState(readToken);
  const [verified, setVerified] = useState(false);
  const [notice, setNotice] = useState<string>('');

  useEffect(() => {
    document.title = `${t.admin.title} — SpkForge`;
    return () => { document.title = 'SpkForge — package source for Synology DSM 7'; };
  }, [t]);

  const signOut = useCallback((message = '') => {
    storeToken('');
    setToken('');
    setVerified(false);
    setNotice(message);
  }, []);

  // A token restored from sessionStorage is checked again before trusting it.
  useEffect(() => {
    if (!token || verified) return;
    let cancelled = false;
    admin.rejected(token)
      .then(() => { if (!cancelled) setVerified(true); })
      .catch((error: unknown) => {
        if (cancelled) return;
        const status = error instanceof ApiError ? error.status : 0;
        signOut(status === 401 ? t.admin.expired : status === 404 ? t.admin.disabled : t.admin.networkError);
      });
    return () => { cancelled = true; };
  }, [token, verified, signOut, t]);

  if (!token || !verified) {
    return (
      <SignIn
        checking={Boolean(token) && !verified}
        notice={notice}
        disabledHint={info.status === 'ok' && !info.data.admin}
        onSignedIn={(value) => {
          storeToken(value);
          setNotice('');
          setToken(value);
          setVerified(true);
        }}
      />
    );
  }

  return <Console token={token} onSignOut={signOut} source={info.status === 'ok' ? info.data.source : `${location.origin}/`} />;
}

/* ------------------------------------------------------------------ */

function SignIn({ checking, notice, disabledHint, onSignedIn }: { checking: boolean; notice: string; disabledHint: boolean; onSignedIn(token: string): void }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const token = value.trim();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await admin.rejected(token);
      onSignedIn(token);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      setError(status === 401 ? t.admin.wrongToken : status === 404 ? t.admin.disabled : t.admin.networkError);
    } finally {
      setBusy(false);
    }
  }

  const message = error || notice || (disabledHint ? t.admin.disabled : '');

  return (
    <div className="wrap admin-signin">
      <form className="signin-card" onSubmit={submit} aria-labelledby="signin-title">
        <span className="signin-key" aria-hidden="true"><IconKey /></span>
        <h1 id="signin-title" className="signin-title">{t.admin.signInTitle}</h1>
        <p className="signin-lead">{t.admin.signInLead}</p>
        <label className="field">
          <span className="field-label">{t.admin.token}</span>
          <input
            className="input mono"
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={message ? 'signin-msg' : undefined}
            required
            autoFocus
          />
        </label>
        {message && (
          <p id="signin-msg" className="signin-msg" role="alert"><IconAlert />{message}</p>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy || checking || !value.trim()}>
          {busy || checking ? t.admin.signingIn : t.admin.signIn}
        </button>
        <Link href="/" className="signin-back">{t.admin.backToSite}</Link>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface Data {
  packages: Package[];
  rejected: RejectedFile[];
  stats: Stats;
}

function Console({ token, onSignOut, source }: { token: string; onSignOut(message?: string): void; source: string }) {
  const { t, number } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++toastId.current;
    setToasts((list) => [...list.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 6000);
  }, []);

  /** Every admin error goes through here: 401 ends the session. */
  const fail = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      onSignOut(t.admin.expired);
      return true;
    }
    toast('bad', t.admin.actionFailed(errorText(error)));
    return false;
  }, [onSignOut, t, toast]);

  const refresh = useCallback(async () => {
    try {
      const [packages, rejected, stats] = await Promise.all([
        getJson<Package[]>('/api/packages'),
        admin.rejected(token),
        admin.stats(token),
      ]);
      invalidate('/api/packages');
      setData({ packages, rejected, stats });
      setLoadError('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSignOut(t.admin.expired);
      else setLoadError(errorText(error));
    }
  }, [token, onSignOut, t]);

  useEffect(() => { void refresh(); }, [refresh]);

  const files = data?.packages.flatMap((p) => p.versions.map((v) => ({ pkg: p, v }))) ?? [];
  const total = data?.stats.byPackage.reduce((sum, row) => sum + row.downloads, 0) ?? 0;

  return (
    <div className="admin">
      <div className="admin-bar">
        <div className="wrap admin-bar-inner">
          <div className="admin-bar-id">
            <h1 className="admin-title">{t.admin.title}</h1>
            <span className="admin-status"><span className="dot" aria-hidden="true" />{t.admin.connected}</span>
            <code className="admin-source" translate="no">{source}</code>
          </div>
          <nav className="admin-nav" aria-label={t.admin.title}>
            <a href="#adm-upload">{t.admin.sections.upload}</a>
            <a href="#adm-files">{t.admin.sections.files}</a>
            <a href="#adm-rejected">{t.admin.sections.rejected}</a>
            <a href="#adm-stats">{t.admin.sections.stats}</a>
            <a href="#adm-maint">{t.admin.sections.maintenance}</a>
          </nav>
          <button type="button" className="btn btn-sm" onClick={() => onSignOut()}>
            <IconLogout />{t.admin.signOut}
          </button>
        </div>
      </div>

      <div className="wrap admin-body">
        {loadError && !data && <ErrorState onRetry={() => void refresh()} body={loadError} />}

        <dl className="kpis" aria-busy={!data}>
          <div><dt>{t.admin.sections.files}</dt><dd className="tabular">{data ? number(files.length) : <Skeleton width="2rem" height="1.6rem" />}</dd></div>
          <div><dt>{t.pkgs.title}</dt><dd className="tabular">{data ? number(data.packages.length) : <Skeleton width="2rem" height="1.6rem" />}</dd></div>
          <div data-alert={data && data.rejected.length > 0 ? true : undefined}>
            <dt>{t.admin.sections.rejected}</dt><dd className="tabular">{data ? number(data.rejected.length) : <Skeleton width="2rem" height="1.6rem" />}</dd>
          </div>
          <div><dt>{t.admin.statsTotal}</dt><dd className="tabular">{data ? number(total) : <Skeleton width="2rem" height="1.6rem" />}</dd></div>
        </dl>

        <div className="admin-top">
          <Upload token={token} onDone={refresh} fail={fail} />
          <Maintenance token={token} onDone={refresh} fail={fail} toast={toast} />
        </div>

        <PublishedFiles files={data ? files : null} token={token} onDone={refresh} fail={fail} toast={toast} />

        <div className="admin-split">
          <Rejected rows={data?.rejected ?? null} />
          <StatsPanel stats={data?.stats ?? null} total={total} />
        </div>
      </div>

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast toast-${x.kind}`}>
            {x.kind === 'ok' ? <IconCheck /> : <IconAlert />}
            <span>{x.text}</span>
            <button type="button" className="icon-btn" aria-label={t.admin.dismiss} onClick={() => setToasts((list) => list.filter((y) => y.id !== x.id))}>
              <IconX />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ProblemList({ problems }: { problems: Problem[] }) {
  const { t } = useI18n();
  return (
    <ul className="problems">
      {problems.map((p, i) => (
        <li key={`${p.code}-${i}`}>
          <span className="problem-code mono">{p.code}</span>
          <span className="problem-text">{t.admin.problems[p.code] ?? p.message}</span>
          {t.admin.problems[p.code] && (
            <span className="problem-raw"><span className="visually-hidden">{t.admin.rawMessage}: </span><code>{p.message}</code></span>
          )}
        </li>
      ))}
    </ul>
  );
}

type UploadState = 'queued' | 'uploading' | 'checking' | 'published' | 'rejected' | 'failed';
interface UploadItem { id: number; file: File; state: UploadState; progress: number; problems: Problem[]; message: string }

function Upload({ token, onDone, fail }: { token: string; onDone(): Promise<void>; fail(e: unknown): boolean }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const queue = useRef(Promise.resolve());

  const patch = (id: number, change: Partial<UploadItem>) =>
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item)));

  function add(fileList: FileList | null) {
    if (!fileList) return;
    const fresh = [...fileList].map((file): UploadItem => ({
      id: ++nextId.current, file, state: 'queued', progress: 0, problems: [], message: '',
    }));
    setItems((list) => [...fresh, ...list]);
    // One at a time, in order: the server indexes each upload synchronously.
    for (const item of fresh) {
      queue.current = queue.current.then(() => send(item));
    }
    queue.current = queue.current.then(() => onDone());
  }

  async function send(item: UploadItem) {
    if (!SPK_FILE_NAME.test(item.file.name)) {
      patch(item.id, { state: 'failed', message: t.admin.badName });
      return;
    }
    patch(item.id, { state: 'uploading', progress: 0 });
    try {
      const { status, result } = await uploadSpk(token, item.file, (fraction) => {
        patch(item.id, fraction >= 1 ? { state: 'checking', progress: 1 } : { progress: fraction });
      });
      patch(item.id, status === 201 ? { state: 'published', progress: 1 } : { state: 'rejected', problems: result.problems });
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 401) {
        fail(error);
        return;
      }
      patch(item.id, {
        state: 'failed',
        message: status === 400 ? t.admin.badName : status === 413 ? t.admin.tooLarge : status === 0 ? t.admin.networkError : errorText(error),
      });
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    add(event.dataTransfer.files);
  }

  const finished = items.some((i) => i.state === 'published' || i.state === 'rejected' || i.state === 'failed');

  return (
    <section id="adm-upload" className="panel" aria-labelledby="upload-title">
      <header className="panel-head">
        <h2 id="upload-title">{t.admin.uploadTitle}</h2>
        <p>{t.admin.uploadLead}</p>
      </header>
      <div
        className="dropzone"
        data-over={over || undefined}
        onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
        onDrop={onDrop}
      >
        <IconUpload className="dropzone-icon" />
        <p className="dropzone-main">{over ? t.admin.dropActive : t.admin.drop}</p>
        <p className="dropzone-sub">
          {t.admin.or}{' '}
          <button type="button" className="linklike" onClick={() => inputRef.current?.click()}>{t.admin.browse}</button>
        </p>
        <p className="dropzone-rule mono">{t.admin.nameRule}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".spk"
          multiple
          className="visually-hidden"
          tabIndex={-1}
          onChange={(e) => { add(e.target.files); e.target.value = ''; }}
        />
      </div>

      {items.length > 0 && (
        <>
          <ul className="uploads">
            {items.map((item) => (
              <li key={item.id} className="upload" data-state={item.state}>
                <div className="upload-row">
                  <IconFile className="upload-icon" />
                  <span className="upload-name mono" translate="no">{item.file.name}</span>
                  <span className="upload-size tabular">{formatBytes(item.file.size, lang)}</span>
                  <span className="upload-state">
                    {item.state === 'queued' && t.admin.queued}
                    {item.state === 'uploading' && t.admin.uploading(Math.round(item.progress * 100))}
                    {item.state === 'checking' && t.admin.checking}
                    {item.state === 'published' && <><IconCheck />{t.admin.published}</>}
                    {item.state === 'rejected' && <><IconAlert />{t.admin.rejected}</>}
                    {item.state === 'failed' && <><IconAlert />{t.admin.failed}</>}
                  </span>
                </div>
                {(item.state === 'uploading' || item.state === 'checking') && (
                  <progress className="upload-progress" max={1} value={item.state === 'checking' ? undefined : item.progress} aria-label={item.file.name} />
                )}
                {item.state === 'rejected' && <ProblemList problems={item.problems} />}
                {item.state === 'failed' && <p className="upload-msg">{item.message}</p>}
              </li>
            ))}
          </ul>
          {finished && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setItems((list) => list.filter((i) => i.state === 'queued' || i.state === 'uploading' || i.state === 'checking'))}>
              {t.admin.clear}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

interface FileRow { pkg: Package; v: PackageVersion }

function PublishedFiles({ files, token, onDone, fail, toast }: {
  files: FileRow[] | null; token: string; onDone(): Promise<void>; fail(e: unknown): boolean; toast(kind: Toast['kind'], text: string): void;
}) {
  const { t, lang, pick, number } = useI18n();
  const [pending, setPending] = useState<string>('');
  const [confirming, setConfirming] = useState<string>('');
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (confirming) cancelRef.current?.focus(); }, [confirming]);

  async function setChannel(fileName: string, channel: 'stable' | 'beta') {
    setPending(fileName);
    try {
      await admin.setChannel(token, fileName, channel);
      toast('ok', t.admin.channelSet(fileName, t.channel[channel]));
      await onDone();
    } catch (error) {
      fail(error);
    } finally {
      setPending('');
    }
  }

  async function withdraw(fileName: string) {
    setPending(fileName);
    try {
      await admin.withdraw(token, fileName);
      toast('ok', t.admin.withdrawn(fileName));
      setConfirming('');
      await onDone();
    } catch (error) {
      fail(error);
    } finally {
      setPending('');
    }
  }

  return (
    <section id="adm-files" className="panel" aria-labelledby="files-title">
      <header className="panel-head">
        <h2 id="files-title">{t.admin.filesTitle}</h2>
        <p>{t.admin.filesLead}</p>
      </header>
      {files === null ? (
        <div className="panel-skel"><Skeleton height="2.4rem" /><Skeleton height="2.4rem" /><Skeleton height="2.4rem" /></div>
      ) : files.length === 0 ? (
        <p className="panel-empty">{t.admin.filesEmpty}</p>
      ) : (
        <div className="atable-wrap">
          <table className="atable">
            <thead>
              <tr>
                <th scope="col">{t.admin.colPackage}</th>
                <th scope="col">{t.admin.colVersion}</th>
                <th scope="col">{t.page.colFamily}</th>
                <th scope="col">{t.page.colChannel}</th>
                <th scope="col" className="num">{t.page.colSize}</th>
                <th scope="col">{t.page.colSha}</th>
                <th scope="col" className="num a-dl">{t.page.colDownloads}</th>
                <th scope="col"><span className="visually-hidden">{t.admin.withdraw}</span></th>
              </tr>
            </thead>
            <tbody>
              {files.map(({ pkg, v }) => (
                <FileRowView
                  key={v.fileName}
                  name={pick(pkg.name)}
                  v={v}
                  busy={pending === v.fileName}
                  confirming={confirming === v.fileName}
                  cancelRef={cancelRef}
                  onChannel={(c) => void setChannel(v.fileName, c)}
                  onAskWithdraw={() => setConfirming(v.fileName)}
                  onCancel={() => setConfirming('')}
                  onWithdraw={() => void withdraw(v.fileName)}
                  lang={lang}
                  number={number}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FileRowView({ name, v, busy, confirming, cancelRef, onChannel, onAskWithdraw, onCancel, onWithdraw, lang, number }: {
  name: string; v: PackageVersion; busy: boolean; confirming: boolean; cancelRef: RefObject<HTMLButtonElement | null>;
  onChannel(c: 'stable' | 'beta'): void; onAskWithdraw(): void; onCancel(): void; onWithdraw(): void;
  lang: ReturnType<typeof useI18n>['lang']; number(n: number): string;
}) {
  const { t } = useI18n();
  const titleId = `wd-${v.fileName.replace(/[^A-Za-z0-9]/g, '-')}`;
  return (
    <>
      <tr data-confirming={confirming || undefined} aria-busy={busy || undefined}>
        <td data-label={t.admin.colPackage}>
          <span className="a-name">{name}</span>
          <span className="a-file mono" translate="no">{v.fileName}</span>
        </td>
        <td data-label={t.admin.colVersion} className="mono">{v.version}</td>
        <td data-label={t.page.colFamily}>
          {v.families.map((f) => t.families[f]).join(', ')}
          <span className="a-sub">DSM {dsmShort(v.osMinVer)}</span>
        </td>
        <td data-label={t.page.colChannel}>
          <div className="seg seg-channel" role="group" aria-label={t.admin.channelOf(v.fileName)}>
            {(['stable', 'beta'] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={v.channel === c}
                disabled={busy}
                data-channel={c}
                onClick={() => { if (v.channel !== c) onChannel(c); }}
              >
                {t.channel[c]}
              </button>
            ))}
          </div>
        </td>
        <td data-label={t.page.colSize} className="num tabular">{formatBytes(v.size, lang)}</td>
        <td data-label={t.page.colSha}>
          <span className="vsha">
            <code title={v.sha256}>{shortHash(v.sha256, 6, 4)}</code>
            <CopyButton text={v.sha256} compact label={`${t.copy.copyFull}: SHA-256 ${v.fileName}`} />
          </span>
        </td>
        <td data-label={t.page.colDownloads} className="num tabular a-dl">{number(v.downloads)}</td>
        <td className="a-actions">
          <button type="button" className="btn btn-sm btn-danger" onClick={onAskWithdraw} disabled={busy || confirming} aria-expanded={confirming}>
            {t.admin.withdraw}
          </button>
        </td>
      </tr>
      {confirming && (
        <tr className="confirm-row">
          <td colSpan={8}>
            <div className="confirm" role="alertdialog" aria-labelledby={titleId} aria-describedby={`${titleId}-d`}>
              <IconAlert className="confirm-icon" />
              <div>
                <p id={titleId} className="confirm-title">{t.admin.withdrawTitle(v.fileName)}</p>
                <p id={`${titleId}-d`} className="confirm-body">{t.admin.withdrawBody}</p>
              </div>
              <div className="confirm-actions">
                <button ref={cancelRef} type="button" className="btn btn-sm" onClick={onCancel} disabled={busy}>{t.admin.cancel}</button>
                <button type="button" className="btn btn-sm btn-danger-solid" onClick={onWithdraw} disabled={busy}>{t.admin.withdrawConfirm}</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Rejected({ rows }: { rows: RejectedFile[] | null }) {
  const { t, lang } = useI18n();
  return (
    <section id="adm-rejected" className="panel" aria-labelledby="rejected-title">
      <header className="panel-head">
        <h2 id="rejected-title">{t.admin.rejectedTitle}</h2>
        <p>{t.admin.rejectedLead}</p>
      </header>
      {rows === null ? (
        <div className="panel-skel"><Skeleton height="3rem" /></div>
      ) : rows.length === 0 ? (
        <p className="panel-empty panel-empty-ok"><IconCheck />{t.admin.rejectedEmpty}</p>
      ) : (
        <ul className="rejected">
          {rows.map((row) => (
            <li key={row.fileName}>
              <div className="rejected-head">
                <span className="mono rejected-name" translate="no">{row.fileName}</span>
                <span className="rejected-at">{t.admin.checkedAt} {formatDate(row.indexedAt, lang)}</span>
              </div>
              <ProblemList problems={row.problems} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Bars({ rows, label }: { rows: { key: string; label: string; value: number }[]; label: string }) {
  const { number } = useI18n();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="bars">
      <figcaption>{label}</figcaption>
      <ul>
        {rows.map((r) => (
          <li key={r.key}>
            <span className="bar-label mono" translate="no">{r.label}</span>
            <span className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ inlineSize: `${(r.value / max) * 100}%` }} />
            </span>
            <span className="bar-value tabular">{number(r.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function StatsPanel({ stats, total }: { stats: Stats | null; total: number }) {
  const { t, number } = useI18n();
  return (
    <section id="adm-stats" className="panel" aria-labelledby="stats-title">
      <header className="panel-head panel-head-row">
        <div>
          <h2 id="stats-title">{t.admin.statsTitle}</h2>
          <p>{t.admin.statsTotal}</p>
        </div>
        <span className="stats-total tabular">{stats ? number(total) : '—'}</span>
      </header>
      {stats === null ? (
        <div className="panel-skel"><Skeleton height="1.2rem" /><Skeleton height="1.2rem" width="70%" /></div>
      ) : (
        <div className="stats">
          {stats.byPackage.length > 0 && (
            <Bars label={t.admin.byPackage} rows={stats.byPackage.map((r) => ({ key: r.id, label: r.id, value: r.downloads }))} />
          )}
          {stats.byPlatform.length > 0 ? (
            <Bars
              label={t.admin.byPlatform}
              rows={stats.byPlatform.map((r) => ({ key: r.platform, label: r.platform === 'web' ? t.admin.webPlatform : r.platform, value: r.downloads }))}
            />
          ) : (
            <p className="panel-empty">{t.admin.byPlatform}: {t.admin.statsEmpty}</p>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Maintenance({ token, onDone, fail, toast }: {
  token: string; onDone(): Promise<void>; fail(e: unknown): boolean; toast(kind: Toast['kind'], text: string): void;
}) {
  const { t, number } = useI18n();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReindexResult | null>(null);

  async function run() {
    setBusy(true);
    try {
      const r = await admin.reindex(token);
      setResult(r);
      toast('ok', t.admin.reindexDone);
      await onDone();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="adm-maint" className="panel" aria-labelledby="maint-title">
      <header className="panel-head">
        <h2 id="maint-title">{t.admin.maintTitle}</h2>
        <p>{t.admin.maintLead}</p>
      </header>
      <button type="button" className="btn" onClick={() => void run()} disabled={busy}>
        <IconRefresh className={busy ? 'spin' : undefined} />{busy ? t.admin.reindexing : t.admin.reindex}
      </button>
      {result && (
        <div className="reindex" role="status">
          <dl className="reindex-counts">
            <div><dt>{t.admin.rIndexed}</dt><dd className="tabular">{number(result.indexed.length)}</dd></div>
            <div data-alert={result.rejected.length > 0 || undefined}><dt>{t.admin.rRejected}</dt><dd className="tabular">{number(result.rejected.length)}</dd></div>
            <div><dt>{t.admin.rRemoved}</dt><dd className="tabular">{number(result.removed.length)}</dd></div>
            <div><dt>{t.admin.rUnchanged}</dt><dd className="tabular">{number(result.unchanged)}</dd></div>
          </dl>
          {[...result.indexed, ...result.removed].length > 0 && (
            <ul className="reindex-files mono">
              {result.indexed.map((f) => <li key={`i-${f}`}>+ {f}</li>)}
              {result.removed.map((f) => <li key={`r-${f}`}>− {f}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
