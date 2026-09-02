"use client";

import { Field, TextInput } from "@/components/ui/Field";

/**
 * The inspector's field vocabulary.
 *
 * Shared by every inspector — clip, composition, storyboard panel, element —
 * so a number is entered the same way everywhere, and a colour is always a
 * swatch beside its hex.
 *
 * Numbers are entered as numbers. A drag handle for `x` would be nicer to use
 * and impossible to be precise with, and the timeline is already the place for
 * approximate.
 */

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

export function NumberField({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <TextInput
        type="number"
        value={value}
        step={step}
        {...(min !== undefined ? { min } : {})}
        {...(max !== undefined ? { max } : {})}
        onChange={(event) => {
          const next = Number(event.target.value);
          // A half-typed "-" or "" parses to NaN, and writing that would fail
          // validation on every keystroke. Ignore it and wait for a number.
          if (!Number.isNaN(next)) onChange(next);
        }}
        className="tabular font-mono text-xs"
      />
    </Field>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          // The native picker cannot express the alpha the schema allows, so
          // it only ever sends the first six digits. Typing the full value in
          // the field beside it is how you get transparency.
          value={value.slice(0, 7)}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={`${label} swatch`}
          className="ds-focus ds-inset size-9 shrink-0 cursor-pointer rounded-sm bg-sunken p-1"
        />
        <TextInput
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="tabular font-mono text-xs"
          spellCheck={false}
          aria-label={label}
        />
      </div>
    </Field>
  );
}

/** A read-only line. Size, frame rate — facts about the film, not settings. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular font-mono text-xs text-ink">{value}</dd>
    </div>
  );
}

/** The inspector's title block: what is selected, and one line about it. */
export function Heading({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="shrink-0 px-4 pt-4 pb-3">
      <h2 className="text-lg font-bold tracking-[var(--ds-tracking-tight)] capitalize">
        {title}
      </h2>
      <p className="tabular mt-0.5 font-mono text-2xs text-subtle">{detail}</p>
    </div>
  );
}
