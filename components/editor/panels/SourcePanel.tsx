"use client";

import { FileCode2, ShieldAlert } from "lucide-react";
import type { ComponentCandidate } from "@/types/prism";
import { PanelShell, PanelSection } from "./PanelShell";
import { SourceIntake } from "./SourceIntake";

type Props = {
  candidates: ComponentCandidate[];
  productName: string;
  framework: string;
  sourceKind: string;
  warnings: string[];
  /**
   * Explicitly `| undefined`: under `exactOptionalPropertyTypes` an optional
   * property and a property that may be passed as `undefined` are different
   * types, and the caller reads this off `scene.componentId`.
   */
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
};

export function SourcePanel({
  candidates,
  productName,
  framework,
  sourceKind,
  warnings,
  selectedId,
  onSelect,
}: Props) {
  return (
    <PanelShell
      title="Source"
      hint="PrismLaunch reads selected files. It never runs your code."
    >
      <PanelSection label="Source">
        <SourceIntake />
      </PanelSection>

      <PanelSection label="Current product">
        <div className="ds-inset rounded-sm bg-sunken p-3.5">
          <p className="font-mono text-xs break-all text-ink">
            {sourceKind} · {productName}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {framework} · {candidates.length} candidate
            {candidates.length === 1 ? "" : "s"}
          </p>
        </div>

        {warnings.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {warnings.map((warning) => (
              <li
                key={warning}
                className="ds-level rounded-sm bg-warning-soft px-3 py-2 text-xs leading-[var(--ds-leading-body)] text-warning"
              >
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </PanelSection>

      <PanelSection label="Component candidates">
        <div className="flex flex-col gap-2">
          {candidates.map((candidate) => {
            const evidence = candidate.evidence[0];
            const isActive = candidate.id === selectedId;

            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onSelect(candidate.id)}
                aria-pressed={isActive}
                className={`ds-focus w-full rounded-sm p-3 text-left transition-[background-color,box-shadow,color] duration-140 ease-[var(--ease-standard)] ${
                  isActive
                    ? "ds-inset bg-sunken"
                    : "ds-raised bg-raised hover:bg-strong"
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileCode2
                    size={14}
                    strokeWidth={1.7}
                    className={isActive ? "text-accent" : "text-subtle"}
                    aria-hidden
                  />
                  <span className="text-xs font-semibold text-ink">
                    {candidate.label}
                  </span>
                  <span className="ds-level ml-auto rounded-pill px-2 py-0.5 text-2xs text-subtle">
                    {candidate.kind}
                  </span>
                </span>

                {evidence ? (
                  <>
                    <span className="mt-2 block font-mono text-xs break-all text-muted">
                      {evidence.path}
                    </span>
                    <span className="mt-1.5 block text-xs leading-[var(--ds-leading-body)] text-muted">
                      {evidence.reason}
                    </span>
                  </>
                ) : null}

                <span className="mt-2 flex flex-wrap gap-1">
                  {candidate.visualTokens.map((token) => (
                    <span
                      key={token}
                      className="ds-level rounded-xs px-2 py-0.5 font-mono text-2xs text-subtle"
                    >
                      {token}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </PanelSection>

      {/* Source text is untrusted by construction. Saying so in the UI is part
          of the product's safety story, not decoration. */}
      <p className="ds-level flex items-start gap-2.5 rounded-sm p-3 text-xs leading-[var(--ds-leading-body)] text-muted">
        <ShieldAlert size={14} strokeWidth={1.7} className="mt-px shrink-0 text-subtle" aria-hidden />
        Text read from source is shown escaped and never treated as instructions.
      </p>
    </PanelShell>
  );
}
