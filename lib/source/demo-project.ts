import { FilmProjectSchema } from "@/lib/studio/schema";
import type { FilmProject } from "@/types/prism";

/**
 * The built-in demo product.
 *
 * This is the deterministic path for the demo — a pre-authored manifest that
 * never depends on the network, GitHub's rate limit, or a repository being
 * parseable. It is always labelled "Demo product manifest" in the UI and never
 * presented as a live scan (context/project-overview.md §Features).
 *
 * Authored by us, so unlike real inspection output it is trusted content.
 */
const draft: FilmProject = {
  id: "demo-vector",
  createdAt: "2026-09-01T14:02:00.000Z",
  updatedAt: "2026-09-01T14:04:09.000Z",
  activeSceneId: "scene-03",

  product: {
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
  },

  brief: {
    promise: "Every action, one keystroke away.",
    selectedComponentIds: ["cmp-command-palette"],
    artDirection: "electric-editorial",
  },

  // 84 + 108 + 132 + 108 = 432 frames = 18.0s, inside the 16–22s window.
  scenes: [
    {
      id: "scene-01",
      order: 1,
      template: "kinetic-type",
      durationFrames: 84,
      headline: "Your issue tracker is a form. Again.",
      motionPreset: "drift",
      emphasis: "problem",
      approval: "accepted",
    },
    {
      id: "scene-02",
      order: 2,
      template: "product-reveal",
      durationFrames: 108,
      headline: "Vector",
      body: "Every action, one keystroke away.",
      motionPreset: "snap",
      emphasis: "product",
      approval: "accepted",
    },
    {
      id: "scene-03",
      order: 3,
      template: "component-spotlight",
      durationFrames: 132,
      headline: "The command palette, not the form.",
      componentId: "cmp-command-palette",
      motionPreset: "snap",
      emphasis: "feature",
      approval: "draft",
      revisionNote: "Made the command palette the hero and tightened the headline.",
      previousHeadline: "Built for speed",
    },
    {
      id: "scene-04",
      order: 4,
      template: "outcome-cta",
      durationFrames: 108,
      headline: "Ship without leaving the keyboard.",
      body: "vector.dev",
      motionPreset: "drift",
      emphasis: "outcome",
      approval: "accepted",
    },
  ],

  activity: [
    {
      id: "ev-1",
      origin: "agent",
      label: "prism.get_project_context",
      detail: "Read brief and 4 candidates",
      at: "14:02:11",
    },
    {
      id: "ev-2",
      origin: "agent",
      label: "prism.create_storyboard_draft",
      detail: "Drafted 4 scenes · 00:18",
      at: "14:02:14",
    },
    {
      id: "ev-3",
      origin: "human",
      label: "Accepted 01, 02, 04",
      detail: "Scene 03 held back",
      at: "14:03:40",
    },
    {
      id: "ev-4",
      origin: "agent",
      label: "prism.revise_scene_draft",
      detail: "scene-03 · hero → CommandPalette",
      at: "14:04:02",
      sceneId: "scene-03",
    },
    {
      id: "ev-5",
      origin: "agent",
      label: "prism.request_render",
      detail: "Proposed a render — needs your confirmation",
      at: "14:04:09",
      blocked: true,
    },
  ],
};

/**
 * Parsed at module load. If the fixture ever violates the graph rules this
 * throws at import time rather than producing a subtly broken film — the
 * fixture is also the test that the schema and the demo agree.
 */
export const demoProject: FilmProject = FilmProjectSchema.parse(draft);
