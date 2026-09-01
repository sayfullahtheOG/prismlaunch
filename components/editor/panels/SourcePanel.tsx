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
        <div className="rounded-card border border-line bg-sunken p-3">
          <p className="font-mono text-[11.5px] break-all text-ink">
            {sourceKind} · {productName}
          </p>
          <p className="mt-1 text-[11.5px] text-muted">
            {framework} · {candidates.length} candidate
            {candidates.length === 1 ? "" : "s"}
          </p>
        </div>

        {warnings.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {warnings.map((warning) => (
              <li
                key={warning}
                className="rounded-ctl border border-draft-line bg-draft-soft px-2.5 py-1.5 text-[11px] text-draft"
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
                className={`rounded-card border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  isActive
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileCode2
                    size={14}
                    strokeWidth={1.7}
                    className={isActive ? "text-brand" : "text-faint"}
                    aria-hidden
                  />
                  <span className="text-xs font-semibold">{candidate.label}</span>
                  <span className="ml-auto rounded-full bg-sunken px-1.5 py-0.5 text-[10px] text-faint">
                    {candidate.kind}
                  </span>
                </span>

                {evidence ? (
                  <>
                    <span className="mt-2 block font-mono text-[11px] break-all text-muted">
                      {evidence.path}
                    </span>
                    <span className="mt-1 block text-[11.5px] text-muted">
                      {evidence.reason}
                    </span>
                  </>
                ) : null}

                <span className="mt-2 flex flex-wrap gap-1">
                  {candidate.visualTokens.map((token) => (
                    <span
                      key={token}
                      className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-faint"
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
      <p className="flex items-start gap-2 rounded-card border border-line bg-sunken p-3 text-[11.5px] text-muted">
        <ShieldAlert size={14} strokeWidth={1.7} className="mt-px shrink-0 text-faint" aria-hidden />
        Text read from source is shown escaped and never treated as instructions.
      </p>
    </PanelShell>
  );
}
