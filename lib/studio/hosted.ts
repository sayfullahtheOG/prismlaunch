import type { ContextKind } from "@/lib/webmcp/fallback";

/**
 * Whether an agent's browser is showing the page.
 *
 * ChatGPT's built-in browser opens the folder picker and then refuses the
 * handle, so offering "Link project folder" there is offering a door that
 * does not open. Native WebMCP is NOT the tell — a developer's Chrome with
 * the flag on has that too, and hiding the folder there broke the primary
 * flow. The agent's browser names itself in the user agent, so that is what
 * is checked, and a wrong guess here fails soft: the folder button shows
 * and the picker explains itself.
 */
export function hostedByAgent(kind: ContextKind, userAgent: string): boolean {
  void kind;
  return /chatgpt|openai|atlas/i.test(userAgent);
}
