"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Icon-only control.
 *
 * `aria-label` is required by the type, not optional — an unlabelled icon
 * button is invisible to a screen reader, and the system requires screen-reader
 * naming on every interactive element. The 44px minimum target is enforced
 * here rather than left to each call site.
 */
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  icon: ReactNode;
  /** Raised reads as an object you can press; quiet suits dense toolbars. */
  tone?: "quiet" | "raised";
  pressed?: boolean;
};

export function IconButton({
  label,
  icon,
  tone = "quiet",
  pressed,
  className = "",
  ...rest
}: Props) {
  const base =
    tone === "raised"
      ? "bg-raised text-ink ds-raised hover:bg-strong"
      : "text-muted hover:bg-sunken hover:text-ink";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`ds-focus grid size-11 shrink-0 place-items-center rounded-sm transition-[background-color,box-shadow,color] duration-140 ease-[var(--ease-standard)] active:ds-pressed disabled:pointer-events-none disabled:opacity-45 ${pressed ? "ds-inset bg-sunken text-accent" : base} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
}
