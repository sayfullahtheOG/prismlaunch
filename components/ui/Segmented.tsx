"use client";

/**
 * Segmented control.
 *
 * A flat track with the chosen segment lifted to the surface colour — the
 * selection is carried by tone and weight, not by a shadow.
 *
 * An option is either a bare value, capitalised for display, or a
 * `{ value, label }` pair when the label is not the value with a capital
 * letter — "GitHub", or a "Folder" tab whose value is `local`.
 */

export type SegmentedOption<T extends string> = T | { value: T; label: string };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex h-8 gap-0.5 rounded-sm bg-sunken p-0.5 shadow-[inset_0_0_0_1px_var(--ds-color-line-soft)]"
    >
      {options.map((option) => {
        const optionValue = typeof option === "string" ? option : option.value;
        const optionLabel = typeof option === "string" ? null : option.label;
        const selected = optionValue === value;

        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            aria-pressed={selected}
            className={`ds-focus flex-1 rounded-xs px-2 text-xs transition-[background-color,color] duration-140 ease-[var(--ease-standard)] ${
              optionLabel === null ? "capitalize" : ""
            } ${
              selected
                ? "bg-strong font-medium text-ink shadow-[0_0_0_1px_var(--ds-color-line-soft)]"
                : "font-medium text-muted hover:text-ink"
            }`}
          >
            {optionLabel ?? optionValue}
          </button>
        );
      })}
    </div>
  );
}
