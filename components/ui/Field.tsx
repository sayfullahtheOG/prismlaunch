"use client";

import type { ReactNode } from "react";

/**
 * Label + control + optional counter and error.
 *
 * The label is sentence case at 12px, the way Figma's inspector labels its
 * fields — not a tracked capital eyebrow. An error is announced with text
 * rather than colour alone.
 */
export function Field({
  label,
  counter,
  over,
  error,
  htmlFor,
  children,
}: {
  label: string;
  counter?: string;
  over?: boolean;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="flex items-center text-xs font-medium text-muted">
        {label}
        {counter ? (
          <span
            className={`tabular ml-auto font-mono text-2xs ${over ? "text-warning" : "text-subtle"}`}
          >
            {counter}
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Flat well with a hairline; the ring brightens on focus via ds-focus. */
const CONTROL =
  "ds-focus w-full rounded-sm bg-sunken px-2.5 text-xs text-ink shadow-[inset_0_0_0_1px_var(--ds-color-line-soft)] placeholder:text-subtle transition-shadow duration-140 ease-[var(--ease-standard)] hover:shadow-[inset_0_0_0_1px_var(--ds-color-line)] disabled:opacity-45";

export function TextInput({
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} h-8 ${className}`} {...rest} />;
}

export function TextArea({
  className = "",
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${CONTROL} resize-none py-2 leading-[var(--ds-leading-body)] ${className}`}
      {...rest}
    />
  );
}

/*
 * The dropdown deliberately lives in ./Select.tsx and is NOT a native
 * `<select>`. The OS renders that control itself — Apple's grey chrome on
 * macOS — ignoring the system's radius, type, elevation and theme, with a
 * popup that cannot be styled at all.
 */
