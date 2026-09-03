import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, vi } from "vitest";
import { buildTools } from "@/lib/webmcp/tools";
import { GUIDE_NAMES } from "@/lib/webmcp/guides";
import type { ModelContextTool } from "@/lib/webmcp/types";

/** Exercise the real onboarding tool with the real shipped documents. */
export async function readGuides(tools: ModelContextTool[]) {
  const fetchGuide = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const name = String(input).slice(1);
    if (!GUIDE_NAMES.some((guide) => guide === name)) throw new Error(`Unexpected URL: ${input}`);
    return new Response(readFileSync(join(process.cwd(), "public", name), "utf8"));
  });
  try {
    const read = tools.find((tool) => tool.name === "prism.read_guide")!;
    for (const document of GUIDE_NAMES) {
      const result = String(await read.execute({ document }));
      expect(result.startsWith(`${document} — full guide.`)).toBe(true);
      expect(result).toContain(readFileSync(join(process.cwd(), "public", document), "utf8"));
    }
  } finally {
    fetchGuide.mockRestore();
  }
  return tools;
}

export const preparedTools = () => readGuides(buildTools());
