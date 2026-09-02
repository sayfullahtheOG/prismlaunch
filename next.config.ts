import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * No `serverExternalPackages` for Remotion any more: the film is encoded in
   * the browser with WebCodecs, so no headless Chromium or FFmpeg binary is
   * ever loaded on the server.
   */

  /**
   * Deliberately NO COOP/COEP or Origin-Agent-Cluster headers.
   *
   * WebMCP requires an origin-keyed agent cluster, which is already the
   * default. Sending `Origin-Agent-Cluster: ?0` (or enabling document.domain)
   * disables the WebMCP APIs outright. Cross-origin isolation via COOP+COEP is
   * a *different* mechanism that WebMCP does not need and that would break
   * embedded resources. See context/architecture.md invariant 14.
   */
};

export default nextConfig;
