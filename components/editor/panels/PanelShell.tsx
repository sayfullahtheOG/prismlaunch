import type { ReactNode } from "react";

type Props = {
  title: string;
  hint?: string;
  children: ReactNode;
};

/** Shared frame for everything in the left panel: title, optional hint, scroll. */
export function PanelShell({ title, hint, children }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
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
    <section className="mb-5">
      <h3 className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
        {label}
      </h3>
      {children}
    </section>
  );
}
