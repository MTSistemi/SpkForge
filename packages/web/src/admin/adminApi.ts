// Admin API client. The token lives in sessionStorage only (gone when the tab
// closes) and travels as a Bearer header on every /api/admin/* call.

import { ApiError, getJson } from '../api.ts';

const TOKEN_KEY = 'spkforge.adminToken';

export const SPK_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,180}\.spk$/;

export interface Problem { code: string; message: string }
export interface RejectedFile { fileName: string; problems: Problem[]; indexedAt: number }
export interface Stats { byPackage: { id: string; downloads: number }[]; byPlatform: { platform: string; downloads: number }[] }
export interface ReindexResult { indexed: string[]; rejected: { fileName: string; problems: Problem[] }[]; removed: string[]; unchanged: number }
export interface UploadResult { fileName: string; published: boolean; problems: Problem[] }

export function readToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function storeToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Kept in memory only.
  }
}

export function adminCall<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  return getJson<T>(`/api/admin/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
}

export const admin = {
  rejected: (token: string) => adminCall<RejectedFile[]>(token, 'rejected'),
  stats: (token: string) => adminCall<Stats>(token, 'stats'),
  reindex: (token: string) => adminCall<ReindexResult>(token, 'reindex', { method: 'POST' }),
  withdraw: (token: string, fileName: string) =>
    adminCall<{ withdrawn: boolean }>(token, `packages/${encodeURIComponent(fileName)}`, { method: 'DELETE' }),
  setChannel: (token: string, fileName: string, channel: 'stable' | 'beta') =>
    adminCall<{ channel: string }>(token, `packages/${encodeURIComponent(fileName)}/channel`, {
      method: 'POST',
      body: JSON.stringify({ channel }),
    }),
};

/**
 * PUT one SPK with upload progress (fetch has no upload progress events).
 * Resolves with the status and parsed body for 201/422; rejects with ApiError otherwise.
 */
export function uploadSpk(token: string, file: File, onProgress: (fraction: number) => void): Promise<{ status: number; result: UploadResult }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/admin/packages/${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.responseType = 'json';
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.upload.onload = () => onProgress(1);
    xhr.onload = () => {
      const body = xhr.response as (UploadResult & { error?: string }) | null;
      if ((xhr.status === 201 || xhr.status === 422) && body) resolve({ status: xhr.status, result: body });
      else reject(new ApiError(xhr.status, body?.error ?? xhr.statusText));
    };
    xhr.onerror = () => reject(new ApiError(0, 'network error'));
    xhr.send(file);
  });
}
