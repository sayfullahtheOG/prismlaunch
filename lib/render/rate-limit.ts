/**
 * IP rate limiting for the render endpoint.
 *
 * The endpoint is unauthenticated by design (PrismLaunch has no accounts) and
 * every render spends real Vercel Sandbox CPU minutes, so an open endpoint is
 * a billing vulnerability rather than a theoretical one
 * (context/architecture.md invariant 15).
 *
 * In-process and therefore per-instance. That is honest for a demo: it bounds
 * the common case without pretending to be a distributed limiter.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_RENDERS_PER_WINDOW = 5;

const hits = new Map<string, number[]>();

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export type RateVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function checkRate(key: string): RateVerdict {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);

  if (recent.length >= MAX_RENDERS_PER_WINDOW) {
    const oldest = recent[0] ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((WINDOW_MS - (now - oldest)) / 1000),
    };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true };
}
