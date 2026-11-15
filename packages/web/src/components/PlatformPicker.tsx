// Searchable platform picker (ARIA 1.2 combobox with a grouped listbox).
// Platforms are grouped by CPU family with friendly labels.

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Family, Platform } from '../api.ts';
import { FAMILY_ORDER } from '../format.ts';
import { useI18n } from '../i18n.tsx';
import { IconChevron, IconSearch, IconX } from './Icons.tsx';

interface PlatformPickerProps {
  platforms: Platform[];
  value: string;
  onChange(platform: string): void;
  labelId: string;
}

export function PlatformPicker({ platforms, value, onChange, labelId }: PlatformPickerProps) {
  const { t } = useI18n();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = platforms.find((p) => p.platform === value);
  const shownText = open ? query : selected ? selected.platform : '';

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byFamily = new Map<Family, Platform[]>();
    for (const p of platforms) {
      if (q && !p.platform.includes(q) && !t.families[p.family].toLowerCase().includes(q) && !p.family.includes(q)) continue;
      byFamily.set(p.family, [...(byFamily.get(p.family) ?? []), p]);
    }
    return FAMILY_ORDER.filter((f) => byFamily.has(f)).map((family) => ({ family, items: byFamily.get(family)! }));
  }, [platforms, query, t]);

  const flat = groups.flatMap((g) => g.items);
  const activeItem = flat[Math.min(active, flat.length - 1)];
  const optionId = (platform: string) => `${listId}-${platform}`;

  function choose(platform: string) {
    onChange(platform);
    setOpen(false);
    setQuery('');
  }

  function scrollActive(index: number) {
    const item = flat[index];
    if (!item) return;
    requestAnimationFrame(() => document.getElementById(optionId(item.platform))?.scrollIntoView({ block: 'nearest' }));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        const start = Math.max(0, flat.findIndex((p) => p.platform === value));
        setActive(start);
        scrollActive(start);
        return;
      }
      const next = event.key === 'ArrowDown' ? Math.min(flat.length - 1, active + 1) : Math.max(0, active - 1);
      setActive(next);
      scrollActive(next);
    } else if (event.key === 'Enter') {
      if (open && activeItem) {
        event.preventDefault();
        choose(activeItem.platform);
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setQuery('');
      }
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActive(0);
      scrollActive(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActive(flat.length - 1);
      scrollActive(flat.length - 1);
    }
  }

  return (
    <div className="picker" data-open={open || undefined}>
      <div className="picker-field">
        <IconSearch className="picker-search" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-labelledby={labelId}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeItem ? optionId(activeItem.platform) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={t.fit.platformPlaceholder}
          value={shownText}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => {
            setOpen(true);
            setActive(Math.max(0, flat.findIndex((p) => p.platform === value)));
          }}
          onBlur={(e) => {
            if (!listRef.current?.contains(e.relatedTarget as Node | null)) {
              setOpen(false);
              setQuery('');
            }
          }}
          onKeyDown={onKeyDown}
        />
        {selected && !open && (
          <span className="picker-family" aria-hidden="true">{t.families[selected.family]}</span>
        )}
        {value && !open ? (
          <button type="button" className="picker-clear" aria-label={t.fit.clear} title={t.fit.clear} onClick={() => { onChange(''); inputRef.current?.focus(); }}>
            <IconX />
          </button>
        ) : (
          <IconChevron className="picker-chevron" />
        )}
      </div>

      <ul ref={listRef} id={listId} role="listbox" aria-labelledby={labelId} className="picker-list" hidden={!open} tabIndex={-1}>
        {groups.length === 0 && <li className="picker-empty" role="presentation">{t.fit.noMatch}</li>}
        {groups.map((group) => (
          <li key={group.family} role="presentation">
            <ul role="group" aria-labelledby={`${listId}-g-${group.family}`}>
              <li role="presentation" id={`${listId}-g-${group.family}`} className="picker-group">
                {t.families[group.family]} <span className="mono">{group.family}</span>
              </li>
              {group.items.map((item) => (
                <li
                  key={item.platform}
                  id={optionId(item.platform)}
                  role="option"
                  aria-selected={item.platform === value}
                  data-active={activeItem?.platform === item.platform || undefined}
                  className="picker-option"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(flat.indexOf(item))}
                  onClick={() => choose(item.platform)}
                >
                  {item.platform}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
