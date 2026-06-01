'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown, FiSearch } from 'react-icons/fi';

export type ComboOption = { value: string; label: string; sub?: string; keywords?: string };

/** Bỏ dấu tiếng Việt + thường hoá để so khớp gần đúng khi gõ. */
function norm(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/**
 * Dropdown có ô gõ-để-lọc (autocomplete) — dùng cho danh sách lớn (KH, SP…).
 * Render danh sách qua portal nên không bị bảng/overflow cắt mất.
 */
export default function Combobox({
  options, value, onChange, placeholder = 'Gõ để tìm…', disabled, className = '', maxRender = 50,
}: {
  options: ComboOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxRender?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return options;
    const terms = q.split(/\s+/).filter(Boolean);
    const scored: { o: ComboOption; score: number }[] = [];
    for (const o of options) {
      const hay = norm(`${o.label} ${o.sub || ''} ${o.keywords || ''}`);
      if (!terms.every((t) => hay.includes(t))) continue;
      const starts = norm(o.label).startsWith(q) ? 0 : 1;
      scored.push({ o, score: starts * 10000 + hay.indexOf(terms[0]) });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.map((s) => s.o);
  }, [options, query]);

  const shown = filtered.slice(0, maxRender);

  function place() {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 2, width: r.width });
  }
  function openList() {
    if (disabled) return;
    place(); setQuery(''); setActive(0); setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  function pick(o: ComboOption) { onChange(o.value); setOpen(false); setQuery(''); }

  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    const onDown = (e: globalThis.MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      if (document.getElementById('combobox-pop')?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) pick(shown[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  }

  return (
    <div className={`cbx ${className}`} ref={wrapRef}>
      <div className="cbx-control" onClick={openList} aria-disabled={disabled}>
        {open ? (
          <input
            ref={inputRef}
            className="cbx-input"
            value={query}
            placeholder={selected ? selected.label : placeholder}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKey}
            disabled={disabled}
          />
        ) : (
          <span className={`cbx-value ${selected ? '' : 'placeholder'}`}>{selected ? selected.label : placeholder}</span>
        )}
        <FiChevronDown className="cbx-arrow" />
      </div>

      {open && mounted && rect && createPortal(
        <div id="combobox-pop" className="cbx-pop" style={{ left: rect.left, top: rect.top, width: rect.width }}>
          {query.trim() && (
            <div className="cbx-pop-hint"><FiSearch /> {filtered.length} kết quả</div>
          )}
          {shown.length === 0 ? (
            <div className="cbx-empty">Không tìm thấy “{query}”</div>
          ) : (
            <>
              {shown.map((o, i) => (
                <div
                  key={o.value}
                  className={`cbx-opt ${i === active ? 'active' : ''} ${o.value === value ? 'sel' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                >
                  <span className="cbx-opt-label">{o.label}</span>
                  {o.sub && <span className="cbx-opt-sub">{o.sub}</span>}
                </div>
              ))}
              {filtered.length > shown.length && (
                <div className="cbx-more">+{filtered.length - shown.length} kết quả nữa — gõ thêm để lọc</div>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
