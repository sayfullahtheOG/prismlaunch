import { ProductManifestSchema } from "@/lib/studio/schema";
import type { ProductManifest } from "@/types/prism";

/**
 * The built-in demo product.
 *
 * A pre-authored manifest of a product that does not exist, offered as one of
 * the three ways to start a film. It is the deterministic path: it never
 * depends on the network, on GitHub's rate limit, or on a repository being
 * parseable, which matters when someone is trying the tool for the first time
 * or watching a demo.
 *
 * It is always labelled "Demo product manifest" in the UI and never presented
 * as a live scan (context/project-overview.md §Features).
 *
 * A manifest is all this file holds. There is deliberately no pre-made film
 * here: choosing this source runs the same inspect -> generate path as a real
 * repository does, so what a first-time visitor sees is a film built in front
 * of them, not somebody else's finished work.
 *
 * Authored by us, so unlike real inspection output this is trusted content.
 */
const draft: ProductManifest = {
  source: "demo",
  productName: "Vector",
  description: "A keyboard-first issue tracker for small product teams.",
  framework: "next",
  inspectionWarnings: [],
  componentCandidates: [
    {
      id: "cmp-command-palette",
      name: "CommandPalette",
      label: "Command palette",
      kind: "component",
      visualTokens: ["command", "search", "results"],
      evidence: [
        {
          path: "src/components/CommandPalette.tsx",
          exportName: "CommandPalette",
          snippet: "export function CommandPalette({ actions }: Props) {",
          reason: "Keyboard-first entry point. Imported by 7 routes.",
        },
      ],
    },
    {
      id: "cmp-issue-list",
      name: "IssueList",
      label: "Issue list",
      kind: "component",
      visualTokens: ["list", "rows", "status"],
      evidence: [
        {
          path: "src/components/IssueList.tsx",
          exportName: "IssueList",
          snippet: "export function IssueList({ issues }: Props) {",
          reason: "Primary surface on the index route.",
        },
      ],
    },
    {
      id: "cmp-cycle-board",
      name: "CycleBoard",
      label: "Cycle board",
      kind: "page",
      visualTokens: ["board", "columns", "drag"],
      evidence: [
        {
          path: "src/app/cycles/page.tsx",
          exportName: "CyclesPage",
          snippet: "export default function CyclesPage() {",
          reason: "Route with the highest component fan-in.",
        },
      ],
    },
    {
      id: "cmp-settings",
      name: "SettingsPanel",
      label: "Settings panel",
      kind: "component",
      visualTokens: ["form", "toggles"],
      evidence: [
        {
          path: "src/components/SettingsPanel.tsx",
          exportName: "SettingsPanel",
          snippet: "export function SettingsPanel() {",
          reason: "Matched 'settings'; low route relevance.",
        },
      ],
    },
  ],
};

/**
 * Parsed at module load, so a fixture that violates the manifest rules throws
 * at import time rather than producing a subtly broken film.
 */
export const demoManifest: ProductManifest = ProductManifestSchema.parse(draft);
