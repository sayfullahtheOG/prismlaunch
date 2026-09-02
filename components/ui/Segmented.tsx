"use client";

/**
 * Segmented control.
 *
 * The track is inset, the selected segment is raised — depth carries the
 * selection, but never alone: the label also changes weight and colour, per
 * the Boundary Rule.
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
      className="ds-inset flex gap-1 rounded-sm bg-sunken p-1"
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
            className={`ds-focus min-h-11 flex-1 rounded-xs px-2 text-xs transition-[background-color,box-shadow,color] duration-140 ease-[var(--ease-standard)] ${
              optionLabel === null ? "capitalize" : ""
            } ${
              selected
                ? "ds-raised bg-raised font-semibold text-ink"
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
