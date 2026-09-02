import type { SourceFile } from "@/lib/source/provider";

/**
 * A synthetic Next.js repository, checked in so extraction tests never touch
 * the network. Deliberately includes the awkward cases: a boring provider, a
 * route group, a component with no JSX, and a README full of badges.
 */
function file(path: string, text: string): SourceFile {
  return { path, text, bytes: Buffer.byteLength(text, "utf8") };
}

export const fixtureRepo: SourceFile[] = [
  file(
    "package.json",
    JSON.stringify(
      {
        name: "@acme/vector-tracker",
        description: "A keyboard-first issue tracker for small product teams.",
        dependencies: { next: "16.0.0", react: "19.0.0" },
      },
      null,
      2,
    ),
  ),

  file(
    "README.md",
    [
      "# Vector",
      "",
      "![build](https://img.shields.io/badge/build-passing-green)",
      "",
      "Vector is an issue tracker where every action has a keyboard shortcut.",
    ].join("\n"),
  ),

  file(
    "src/components/CommandPalette.tsx",
    [
      "import { useHotkeys } from '../hooks/useHotkeys';",
      "",
      "export function CommandPalette({ actions }: Props) {",
      "  return <div className=\"palette\">{actions.map(renderAction)}</div>;",
      "}",
    ].join("\n"),
  ),

  file(
    "src/components/IssueList.tsx",
    [
      "import { CommandPalette } from './CommandPalette';",
      "",
      "export function IssueList({ issues }: Props) {",
      "  return <ul>{issues.map((i) => <li key={i.id}>{i.title}</li>)}</ul>;",
      "}",
    ].join("\n"),
  ),

  file(
    "src/app/cycles/page.tsx",
    [
      "import { CommandPalette } from '../../components/CommandPalette';",
      "",
      "export default function CyclesPage() {",
      "  return <main><CommandPalette actions={[]} /></main>;",
      "}",
    ].join("\n"),
  ),

  file(
    "src/app/(marketing)/pricing/page.tsx",
    "export default function PricingPage() {\n  return <section>Pricing</section>;\n}",
  ),

  // Plumbing — should score below the real surfaces.
  file(
    "src/components/ThemeProvider.tsx",
    [
      "import { CommandPalette } from './CommandPalette';",
      "export function ThemeProvider({ children }: Props) {",
      "  return <>{children}</>;",
      "}",
    ].join("\n"),
  ),

  // No JSX — a helper that happens to be exported with a capital.
  file(
    "src/components/Formatters.ts",
    "export const FormatDate = (d: Date) => d.toISOString();",
  ),
];

/** A repository with metadata but nothing filmable. */
export const bareRepo: SourceFile[] = [
  file(
    "package.json",
    JSON.stringify({ name: "cli-tool", description: "A command line tool." }),
  ),
  file("README.md", "# cli-tool\n\nDoes things in a terminal, with no UI at all."),
];
