"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface FileMenuItem {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  dividerAbove?: boolean;
  onSelect: () => void;
}

/**
 * Dropdown file menu. Anchored under its trigger button; closes on outside
 * click or Escape; navigable with arrow keys like a native menu.
 */
export function FileMenu({
  items,
}: {
  /** first item whose id is "save-as" gets the active save name rendered via hint */
  items: FileMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // close on any click outside the menu + button
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({
      top: r.bottom + 6,
      left: Math.max(8, Math.min(r.left, window.innerWidth - 280)),
    });
  }, [open]);

  let index = -1;

  return (
    <>
      <button
        ref={btnRef}
        className={`btn btn-small bw-file-btn ${open ? "bw-file-btn-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="File actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ☰ File ▾
      </button>
      {open && (
        <div
          ref={menuRef}
          className="bw-context-menu bw-file-menu"
          role="menu"
          style={{ top: pos.top, left: pos.left }}
          onKeyDown={(e) => {
            const els = menuRef.current
              ? Array.from(menuRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"))
              : [];
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (els.length === 0) return;
              const i = els.indexOf(document.activeElement as HTMLButtonElement);
              const next =
                e.key === "ArrowDown"
                  ? els[(i + 1) % els.length]
                  : els[(i - 1 + els.length) % els.length];
              next?.focus();
            }
          }}
        >
          <div className="bw-ctx-header">File</div>
          {items.map((item) => {
            if (item.dividerAbove) index = -2; // reset mnemonic-free zone (keeps map keys stable)
            return (
              <div key={item.id}>
                {item.dividerAbove && <div className="bw-file-menu-divider" />}
                <button
                  className={`bw-ctx-item ${item.danger ? "bw-file-item-danger" : ""}`}
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  <span className="bw-ctx-item-title">
                    {item.label}
                    {item.shortcut && (
                      <span className="bw-file-menu-kbd">{item.shortcut}</span>
                    )}
                  </span>
                  {item.hint && <span className="bw-ctx-item-hint">{item.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
          )}
    </>
  );
}
