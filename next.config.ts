import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * @remotion/renderer ships a headless browser and FFmpeg binaries. Bundling
   * it breaks the build, so it must stay external and load from node_modules
   * at runtime. Note the related rule in context/architecture.md: never import
   * @remotion/bundler inside an API route either — it pulls in webpack, which
   * conflicts with route bundling.
   */
  serverExternalPackages: ["@remotion/renderer"],

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
