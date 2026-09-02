import type { ReactNode } from "react";

/** Shared frame for the contextual panel: title, optional hint, scroll. */
export function PanelShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-4 pb-3">
        <h2 className="text-lg font-bold tracking-[var(--ds-tracking-tight)]">
          {title}
        </h2>
        {hint ? (
          <p className="mt-1 text-xs leading-[var(--ds-leading-body)] text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {children}
      </div>
    </div>
  );
}

export function PanelSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-2.5 text-2xs font-semibold tracking-[var(--ds-tracking-label)] text-subtle uppercase">
        {label}
      </h3>
      {children}
    </section>
  );
}
