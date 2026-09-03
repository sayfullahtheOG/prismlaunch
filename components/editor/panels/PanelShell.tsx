import type { ReactNode } from "react";

/** Shared frame for the contextual panel: title, optional hint, scroll. */
export function PanelShell({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  /** One control that belongs to the whole panel, at the title's right. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 text-md font-semibold tracking-[var(--ds-tracking-tight)] text-ink">
            {title}
          </h2>
          {action}
        </div>
        {hint ? (
          <p className="mt-1 text-xs leading-[var(--ds-leading-body)] text-muted">{hint}</p>
        ) : null}
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
    </div>
  );
}

/**
 * A titled run of a panel.
 *
 * Sentence case, small, with a hairline above so sections read as rows of
 * one column rather than as a stack of labelled cards.
 */
export function PanelSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line-soft py-4 first:border-t-0 first:pt-0">
      <h3 className="mb-2.5 text-xs font-medium text-muted">{label}</h3>
      {children}
    </section>
  );
}
