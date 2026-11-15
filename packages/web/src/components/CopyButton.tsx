// Copy-to-clipboard button with a visible and announced confirmation.

import { useEffect, useRef, useState } from 'react';
import { copyText } from '../clipboard.ts';
import { useI18n } from '../i18n.tsx';
import { IconCheck, IconCopy } from './Icons.tsx';

interface CopyButtonProps {
  text: string;
  className?: string;
  /** Icon only (accessible name from `label`). */
  compact?: boolean;
  label?: string;
  onCopied?: () => void;
}

export function CopyButton({ text, className = '', compact = false, label, onCopied }: CopyButtonProps) {
  const { t } = useI18n();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    const ok = await copyText(text);
    setState(ok ? 'copied' : 'failed');
    if (ok) onCopied?.();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2200);
  }

  const idleLabel = label ?? t.copy.copy;
  const shown = state === 'copied' ? t.copy.copied : state === 'failed' ? t.copy.failed : idleLabel;

  return (
    <>
      <button
        type="button"
        className={`copy-btn ${compact ? 'icon-btn' : 'btn'} ${className}`}
        data-state={state}
        onClick={copy}
        aria-label={compact ? shown : undefined}
        title={compact ? shown : undefined}
      >
        {state === 'copied' ? <IconCheck /> : <IconCopy />}
        {!compact && <span>{shown}</span>}
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {state === 'copied' ? t.copy.copiedFull : ''}
      </span>
    </>
  );
}
