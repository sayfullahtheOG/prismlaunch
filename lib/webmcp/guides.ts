import type { ActionResult } from "@/lib/studio/actions";

export const GUIDE_NAMES = ["SKILL.md", "PRISM_METHOD.md"] as const;
type GuideName = (typeof GUIDE_NAMES)[number];

const REQUIREMENT =
  "Before planning, drafting or editing a film, call prism.read_guide for SKILL.md and PRISM_METHOD.md and read both full results. SKILL.md covers operation; PRISM_METHOD.md covers creative decisions. Re-read the relevant sections before each stage or revision.";

/** Delivery is per tool registration, never a saved claim that an agent understood it. */
export function createGuideSession() {
  const delivered = new Set<GuideName>();
  const missing = () => GUIDE_NAMES.filter((name) => !delivered.has(name));

  return {
    context() {
      return {
        instruction: REQUIREMENT,
        deliveredThisSession: GUIDE_NAMES.filter((name) => delivered.has(name)),
        requiredBeforeWork: missing(),
        guides: GUIDE_NAMES.map((document) => ({
          document,
          url: `https://tryprismlaunch.vercel.app/${document}`,
        })),
      };
    },
    beforeWrite(): string | null {
      const pending = missing();
      return pending.length
        ? `Read the required guides before starting work. Call prism.read_guide for ${pending.join(" and ")}, read the full returned text, then retry. No project changes were made.`
        : null;
    },
    async read(document: GuideName): Promise<ActionResult> {
      try {
        const response = await fetch(`/${document}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const markdown = await response.text();
        // A fallback HTML page or empty response must not unlock creative tools.
        const expectedName = document === "SKILL.md" ? "prismlaunch" : "prism-method";
        if (!markdown.startsWith("---\n") || !markdown.includes(`\nname: ${expectedName}\n`)) {
          throw new Error("The response was not the requested guide");
        }
        delivered.add(document);
        const pending = missing();
        return {
          ok: true,
          message: `${document} — full guide. Read all of it before starting work.\n\n${markdown}\n\n---\n${pending.length ? `Next: call prism.read_guide for ${pending.join(" and ")} and read it too.` : "Both guides have been delivered. Apply them, then read prism.get_project_context and follow the current stage and the person's notes. Delivery does not replace reading or human stage approval."}`,
        };
      } catch (error) {
        return {
          ok: false,
          code: "guide-unavailable",
          message: `Could not load ${document}: ${error instanceof Error ? error.message : String(error)}. Retry prism.read_guide; this request did not satisfy the guide requirement.`,
        };
      }
    },
  };
}
