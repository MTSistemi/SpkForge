// Public API types and a tiny cached fetch hook. No data library: the API is
// small, same-origin, and the server sends Cache-Control: no-store.

import { useCallback, useEffect, useState } from 'react';

export type Family = 'x86_64' | 'armv8' | 'armv7' | 'i686' | 'noarch';
export type Channel = 'stable' | 'beta';
export interface Localized { enu: string; ita: string }

export interface Info { name: string; source: string; admin: boolean }

export interface PackageVersion {
  version: string;
  fileName: string;
  channel: Channel;
  arch: string[];
  families: Family[];
  osMinVer: string;
  size: number;
  md5: string;
  sha256: string;
  downloads: number;
  download: string;
  changelog: Localized;
}

export interface Package {
  id: string;
  name: Localized;
  description: Localized;
  maintainer: string;
  maintainerUrl: string;
  helpUrl: string;
  supportUrl: string;
  latestVersion: string;
  hasBeta: boolean;
  families: Family[];
  downloads: number;
  icon: string;
  versions: PackageVersion[];
}

export interface Platform { platform: string; family: Family }

export interface PreviewEntry {
  package: string;
  version: string;
  dname: string;
  desc: string;
  link: string;
  size: number;
  md5: string;
  beta: boolean;
  thumbnail: string[];
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { Accept: 'application/json', ...init?.headers } });
  if (!response.ok) {
    let message = response.statusText;
    try {
      message = ((await response.json()) as { error?: string }).error ?? message;
    } catch {
      // Body was not JSON; keep the status text.
    }
    throw new ApiError(response.status, message);
  }
  return (await response.json()) as T;
}

export type Resource<T> =
  | { status: 'loading'; data?: undefined; error?: undefined; reload(): void }
  | { status: 'ok'; data: T; error?: undefined; reload(): void }
  | { status: 'error'; data?: undefined; error: ApiError | Error; reload(): void };

/** Results kept for the page's lifetime so moving between routes is instant. */
const cache = new Map<string, unknown>();

/** Drop cached responses whose URL starts with the prefix (after admin changes). */
export function invalidate(prefix: string): void {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

export function seed<T>(url: string, value: T): void {
  if (!cache.has(url)) cache.set(url, value);
}

/** Fetch a JSON resource; pass null to fetch nothing. */
export function useResource<T>(url: string | null): Resource<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ url: string | null; status: 'loading' | 'ok' | 'error'; data?: T; error?: Error }>(
    () => (url !== null && cache.has(url) ? { url, status: 'ok', data: cache.get(url) as T } : { url, status: 'loading' }),
  );
  const reload = useCallback(() => {
    if (url !== null) cache.delete(url);
    setNonce((n) => n + 1);
  }, [url]);

  useEffect(() => {
    if (url === null) return;
    if (cache.has(url)) {
      setState({ url, status: 'ok', data: cache.get(url) as T });
      return;
    }
    const controller = new AbortController();
    setState((prev) => (prev.url === url && prev.status === 'ok' ? prev : { url, status: 'loading' }));
    getJson<T>(url, { signal: controller.signal })
      .then((data) => {
        cache.set(url, data);
        setState({ url, status: 'ok', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ url, status: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      });
    return () => controller.abort();
  }, [url, nonce]);

  // A stale state from a previous URL counts as loading.
  if (state.url !== url || url === null) return { status: 'loading', reload };
  if (state.status === 'ok') return { status: 'ok', data: state.data as T, reload };
  if (state.status === 'error') return { status: 'error', error: state.error ?? new Error('error'), reload };
  return { status: 'loading', reload };
}
