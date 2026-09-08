"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export interface SortOption {
  value: string;
  label: string;
}

/**
 * Deliberately trainer-hostile custom dropdown (demo asset, TAMD ticket in
 * PR): not an HTML <select>; the menu closes on focus loss and shortly after
 * the pointer leaves the widget, reproducing the "disappearing dropdown"
 * automation problem. Fully keyboard-operable so tests can drive it
 * deterministically via data-testid + keys.
 */
export function SortDropdown({
  options,
  current,
  label,
  query,
}: {
  options: SortOption[];
  current: string;
  label: string;
  query: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(
    Math.max(
      0,
      options.findIndex((o) => o.value === current),
    ),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  // Disappearing behavior #1: any pointerdown outside closes the menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  const select = (value: string) => {
    close();
    const params = new URLSearchParams(query);
    if (value === "featured") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }
    const qs = params.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const isDown = e.key === "ArrowDown" || e.key === "Down";
    const isUp = e.key === "ArrowUp" || e.key === "Up";
    if (!open && (e.key === "Enter" || e.key === " " || isDown)) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (isDown) {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (isUp) {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(options[activeIndex].value);
    } else if (e.key === "Escape") {
      close();
    }
  };

  const currentLabel =
    options.find((o) => o.value === current)?.label ?? options[0].label;

  return (
    <div
      ref={rootRef}
      className="relative inline-block text-left"
      data-testid="sort-dropdown"
      // Disappearing behavior #2: menu closes when focus leaves the widget.
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) close();
      }}
      // Disappearing behavior #3: menu closes ~400ms after the mouse leaves.
      onMouseLeave={() => {
        if (!open) return;
        leaveTimer.current = setTimeout(() => setOpen(false), 400);
      }}
      onMouseEnter={() => {
        if (leaveTimer.current) {
          clearTimeout(leaveTimer.current);
          leaveTimer.current = null;
        }
      }}
    >
      <button
        type="button"
        data-testid="sort-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onKeyDown}
        className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm font-semibold hover:border-[color:var(--primary)]"
      >
        <span className="text-[color:var(--muted)]">{label}:</span>
        <span data-testid="sort-dropdown-current">{currentLabel}</span>
        <span aria-hidden className="text-[color:var(--muted)]">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div
          role="listbox"
          data-testid="sort-dropdown-menu"
          aria-activedescendant={`sort-option-${options[activeIndex].value}`}
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl"
        >
          {options.map((o, i) => (
            <div
              key={o.value}
              id={`sort-option-${o.value}`}
              role="option"
              aria-selected={o.value === current}
              data-testid={`sort-option-${o.value}`}
              // Select on pointerdown: fires before the trigger's blur
              // unmounts the menu, so real mouse users can still choose an
              // option — while anything that dispatches a plain click (or
              // steals focus first) finds the menu already gone.
              onPointerDown={(e) => {
                e.preventDefault();
                select(o.value);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === activeIndex
                  ? "bg-[color:var(--primary)]/20 text-[color:var(--foreground)]"
                  : "text-[color:var(--muted)]"
              } ${o.value === current ? "font-bold" : ""}`}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
