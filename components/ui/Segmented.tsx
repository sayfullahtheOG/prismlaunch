"use client";

/**
 * Segmented control.
 *
 * The track is inset, the selected segment is raised — depth carries the
 * selection, but never alone: the label also changes weight and colour, per
 * the Boundary Rule.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
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
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={selected}
            className={`ds-focus min-h-11 flex-1 rounded-xs px-2 text-xs capitalize transition-[background-color,box-shadow,color] duration-140 ease-[var(--ease-standard)] ${
              selected
                ? "ds-raised bg-raised font-semibold text-ink"
                : "font-medium text-muted hover:text-ink"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
