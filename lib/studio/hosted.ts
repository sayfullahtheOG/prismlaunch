import type { ContextKind } from "@/lib/webmcp/fallback";

/**
 * Whether an agent's browser is showing the page.
 *
 * ChatGPT's built-in browser opens the folder picker and then refuses the
 * handle, so offering "Link project folder" there is offering a door that
 * does not open. There is no honest feature test for that (the picker
 * exists; it is the grant that never comes), but there is a tell: a browser
 * that hands the page's tools to an agent is a browser an agent is driving,
 * and today only ChatGPT's does. The user agent is checked too, for the day
 * the name appears in it. Flagged Chrome with WebMCP on loses the folder
 * button in the setup dialog and keeps it in the Files section, which is
 * the right way round for a developer who turned the flag on.
 */
export function hostedByAgent(kind: ContextKind, userAgent: string): boolean {
  if (kind === "native") return true;
  return /chatgpt|openai/i.test(userAgent);
}
