"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The one button.
 *
 * Short, because this is an editor: 32px is the height of a control in the
 * tools people already trust, and a panel full of 44px buttons reads as a
 * phone app. `primary` is monochrome — ink fill, inverse label — because
 * black-and-white actions are the default and the accent is reserved for
 * state. `signal` exists for the rare action that is genuinely a state
 * change worth accenting.
 */
type Variant = "primary" | "secondary" | "quiet" | "signal" | "attention";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-inverse hover:opacity-90 active:opacity-80",
  secondary:
    "bg-raised text-ink shadow-[inset_0_0_0_1px_var(--ds-color-line)] hover:bg-strong active:bg-sunken",
  quiet: "bg-transparent text-muted hover:bg-sunken hover:text-ink active:bg-strong",
  signal: "bg-accent text-inverse hover:bg-accent-hover active:opacity-90",
  attention: "bg-warning text-inverse hover:opacity-90 active:opacity-80",
};

const SIZE: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-8 px-3 text-xs gap-2",
  lg: "h-9 px-3.5 text-sm gap-2",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Renders a spinner and blocks interaction. */
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`ds-focus inline-flex items-center justify-center rounded-sm font-medium whitespace-nowrap transition-[background-color,box-shadow,opacity] duration-140 ease-[var(--ease-standard)] disabled:pointer-events-none disabled:opacity-45 ${SIZE[size]} ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-3 shrink-0 animate-spin rounded-pill border-2 border-current border-t-transparent"
    />
  );
}
