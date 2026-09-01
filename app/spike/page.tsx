import { WebMcpProbe } from "./WebMcpProbe";

export const metadata = { title: "WebMCP probe · PrismLaunch" };

/**
 * Development spike. Kept in the repo because it is the fastest way to answer
 * "does WebMCP work in this browser?" — the question the whole submission
 * rests on. Linked from the README, not from the product UI.
 */
export default function SpikePage() {
  return <WebMcpProbe />;
}
