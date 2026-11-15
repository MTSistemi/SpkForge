// Shared loading and error views.

import type { ReactNode } from 'react';
import { useI18n } from '../i18n.tsx';
import { IconAlert, IconRefresh } from './Icons.tsx';

export function ErrorState({ onRetry, title, body }: { onRetry?: () => void; title?: string; body?: string }) {
  const { t } = useI18n();
  return (
    <div className="state state-error" role="alert">
      <p className="state-title"><IconAlert />{title ?? t.state.errorTitle}</p>
      <p>{body ?? t.state.errorBody}</p>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          <IconRefresh />{t.state.retry}
        </button>
      )}
    </div>
  );
}

export function Skeleton({ width = '100%', height = '1rem', className = '' }: { width?: string; height?: string; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}

export function Loading({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div aria-busy="true">
      <span className="visually-hidden" role="status">{t.state.loading}</span>
      {children}
    </div>
  );
}
