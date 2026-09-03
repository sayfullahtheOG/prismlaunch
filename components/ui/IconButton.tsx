"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Icon-only control.
 *
 * `aria-label` is required by the type, not optional — an unlabelled icon
 * button is invisible to a screen reader. Two sizes: `md` (32px) for
 * toolbars, `sm` (24px) for controls that belong to a row — a layer header,
 * a list item — where a larger target would cost rows on screen.
 */
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  icon: ReactNode;
  /** Raised reads as an object you can press; quiet suits dense toolbars. */
  tone?: "quiet" | "raised";
  pressed?: boolean;
  size?: "sm" | "md";
};

export function IconButton({
  label,
  icon,
  tone = "quiet",
  pressed,
  size = "md",
  className = "",
  ...rest
}: Props) {
  const base =
    tone === "raised"
      ? "bg-raised text-ink shadow-[inset_0_0_0_1px_var(--ds-color-line)] hover:bg-strong"
      : "text-muted hover:bg-sunken hover:text-ink";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`ds-focus grid shrink-0 place-items-center rounded-sm transition-[background-color,box-shadow,color] duration-140 ease-[var(--ease-standard)] disabled:pointer-events-none disabled:opacity-45 ${size === "sm" ? "size-6" : "size-8"} ${pressed ? "bg-accent-soft text-accent" : base} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
}
