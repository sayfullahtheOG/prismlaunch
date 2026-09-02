import type { ProjectEntry } from "@/lib/workspace/fs";

/**
 * Where to land once a folder is linked.
 *
 * The setup dialog closes when a composition is open, and nothing else
 * closes it. So linking a folder — or re-granting one after a reload — has
 * to end with something open, or the person is left looking at a list they
 * did not ask for after the click they were told would finish the setup.
 * The first version opened a composition only when the folder held exactly
 * one, and in ChatGPT's browser that read as "I picked the folder and the
 * modal is still there".
 *
 * The rule: the most recently edited composition that reads, because that
 * is the one someone was working on; a blank one if nothing reads, because
 * an editor is a better place to discover a broken file than a modal. The
 * title bar's menu is where you switch, and that is one click away.
 */
export type Landing = { kind: "open"; slug: string } | { kind: "create" };

export function pickLanding(projects: readonly ProjectEntry[]): Landing {
  const readable = projects
    .filter((entry) => entry.problem === null && entry.name !== null)
    .sort((a, b) => b.modifiedAt - a.modifiedAt);

  const first = readable[0];
  return first ? { kind: "open", slug: first.slug } : { kind: "create" };
}
