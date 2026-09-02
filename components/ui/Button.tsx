"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The one button.
 *
 * `primary` is monochrome by default — ink fill, inverse label — because the
 * system says black/white actions are the default and cobalt must be *earned*
 * through interaction or state. `signal` exists for the rare action that is
 * genuinely a state change worth accenting; reach for it deliberately.
 *
 * Depth follows the Press Rule: raised at rest, pressed on :active, never
 * moving more than 1px.
 */
type Variant = "primary" | "secondary" | "quiet" | "signal" | "attention";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-ink text-inverse ds-raised hover:opacity-90 active:ds-pressed active:translate-y-px",
  secondary:
    "bg-raised text-ink ds-raised hover:bg-strong active:ds-pressed active:translate-y-px",
  quiet:
    "bg-transparent text-muted hover:bg-sunken hover:text-ink active:ds-pressed",
  signal:
    "bg-accent text-inverse ds-raised hover:bg-accent-hover active:ds-pressed active:translate-y-px",
  attention:
    "bg-warning text-inverse ds-raised hover:opacity-90 active:ds-pressed active:translate-y-px",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Renders a spinner and blocks interaction. */
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "secondary",
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
      className={`ds-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold whitespace-nowrap transition-[background-color,box-shadow,opacity,transform] duration-140 ease-[var(--ease-standard)] disabled:pointer-events-none disabled:opacity-45 ${VARIANT[variant]} ${className}`}
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
      className="size-3.5 shrink-0 animate-spin rounded-pill border-2 border-current border-t-transparent"
    />
  );
}
