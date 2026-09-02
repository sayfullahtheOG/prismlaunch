"use client";

import type { ReactNode } from "react";

/**
 * Label + control + optional counter and error.
 *
 * Fields are INSET: the system reserves that recipe for "text fields, tracks,
 * pressed wells". An error is announced with text and an icon-free `role`
 * rather than colour alone, since colour cannot be the only state indicator.
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
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-center text-2xs font-semibold tracking-[var(--ds-tracking-label)] text-subtle uppercase"
      >
        {label}
        {counter ? (
          <span
            className={`tabular ml-auto font-mono text-2xs normal-case ${over ? "text-warning" : "text-subtle"}`}
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

const CONTROL =
  "ds-inset ds-focus w-full rounded-sm bg-sunken px-3 text-sm text-ink placeholder:text-subtle transition-shadow duration-140 ease-[var(--ease-standard)] disabled:opacity-45";

export function TextInput({
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} min-h-11 ${className}`} {...rest} />;
}

export function TextArea({
  className = "",
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={`${CONTROL} resize-none py-2.5 ${className}`} {...rest} />
  );
}

/*
 * The dropdown deliberately lives in ./Select.tsx and is NOT a native
 * `<select>`. The OS renders that control itself — Apple's grey chrome on
 * macOS — ignoring the system's radius, type, elevation and theme, with a
 * popup that cannot be styled at all.
 */
