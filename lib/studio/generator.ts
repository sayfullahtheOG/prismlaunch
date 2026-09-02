import { HEADLINE_MAX, BODY_MAX, SceneGraphSchema } from "./schema";
import type { Brief, ComponentCandidate, ProductManifest, Scene } from "@/types/prism";

/**
 * The deterministic storyboard generator.
 *
 * Pure: `(manifest, brief) => Scene[]`. No network, no clock, no randomness —
 * the same inputs always produce the same board. That matters for three
 * reasons: the demo is reproducible, the tests are meaningful, and the product
 * stays coherent when no agent is present at all.
 *
 * This is not trying to write great copy. It produces a board that is
 * *immediately playable and structurally correct*, which the human or their
 * agent then sharpens. Overclaiming here would be the "AI understood your
 * repo" move the spec explicitly rejects.
 */

// Authored pain lines for the hook. Chosen by a stable hash of the product
// name so two different products do not open identically, while the same
// product always opens the same way.
const HOOKS: readonly string[] = [
  "Most tools make you click. A lot.",
  "The work is fast. The tooling isn't.",
  "You shipped it. Now explain it.",
  "Every workflow starts with a form.",
  "Powerful software, buried in menus.",
];

/** Closing lines, chosen the same way. */
const OUTCOMES: readonly string[] = [
  "Less clicking. More shipping.",
  "The fast path, by default.",
  "Built for the way you actually work.",
];

/**
 * A small deterministic string hash (FNV-1a). Only used to pick a template
 * index, so collisions are harmless.
 */
function hash(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

function pick<T>(options: readonly T[], seed: string): T {
  return options[hash(seed) % options.length]!;
}

/**
 * Trim to a length limit at a word boundary, so a generated headline never
 * ends mid-word or trips the schema. Adds no ellipsis — a clipped fragment
 * reads worse than a shorter complete phrase.
 */
export function fit(text: string, limit: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= limit) return clean;

  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > limit * 0.5 ? cut.slice(0, lastSpace) : cut;
  return trimmed.replace(/[,;:.\-–—]+$/, "").trim();
}

/**
 * Choose the component the proof scene features.
 *
 * The brief's first selected candidate wins; otherwise the manifest's first,
 * which the inspection pipeline has already ordered by score.
 */
function chooseFeature(
  manifest: ProductManifest,
  brief: Brief,
): ComponentCandidate | undefined {
  const selected = brief.selectedComponentIds[0];
  if (selected) {
    const match = manifest.componentCandidates.find((c) => c.id === selected);
    if (match) return match;
  }
  return manifest.componentCandidates[0];
}

/**
 * Frame durations, in fixed proportions that total 432 frames = 18s at 24fps,
 * comfortably inside the 16–22s window. The proof scene gets the most time
 * because it is the one carrying real product information.
 */
const DURATIONS = {
  hook: 84, // 3.5s
  reveal: 108, // 4.5s
  proof: 132, // 5.5s
  resolve: 108, // 4.5s
} as const;

export function generateStoryboard(
  manifest: ProductManifest,
  brief: Brief,
): Scene[] {
  const productName = manifest.productName.trim() || "This product";
  const feature = chooseFeature(manifest, brief);
  const seed = `${productName}:${brief.artDirection}`;

  const hook = pick(HOOKS, seed);
  const outcome = pick(OUTCOMES, `${seed}:outcome`);

  // The proof headline names the feature by its friendly label. If inspection
  // found nothing, say something true and general rather than inventing a
  // capability the source does not evidence.
  const proofHeadline = feature
    ? `Meet the ${feature.label.toLowerCase()}.`
    : `Inside ${productName}.`;

  const scenes: Scene[] = [
    {
      id: "scene-01",
      order: 1,
      template: "kinetic-type",
      durationFrames: DURATIONS.hook,
      headline: fit(hook, HEADLINE_MAX),
      motionPreset: "drift",
      emphasis: "problem",
      approval: "accepted",
    },
    {
      id: "scene-02",
      order: 2,
      template: "product-reveal",
      durationFrames: DURATIONS.reveal,
      headline: fit(productName, HEADLINE_MAX),
      body: fit(brief.promise, BODY_MAX),
      motionPreset: "snap",
      emphasis: "product",
      approval: "accepted",
    },
    {
      id: "scene-03",
      order: 3,
      template: "component-spotlight",
      durationFrames: DURATIONS.proof,
      headline: fit(proofHeadline, HEADLINE_MAX),
      ...(feature ? { componentId: feature.id } : {}),
      motionPreset: "snap",
      emphasis: "feature",
      approval: "accepted",
    },
    {
      id: "scene-04",
      order: 4,
      template: "outcome-cta",
      durationFrames: DURATIONS.resolve,
      headline: fit(outcome, HEADLINE_MAX),
      body: fit(productName, BODY_MAX),
      motionPreset: "drift",
      emphasis: "outcome",
      approval: "accepted",
    },
  ];

  // A generator that emits an invalid graph is a bug, not a user error — fail
  // loudly here rather than letting it reach the renderer.
  return SceneGraphSchema.parse(scenes);
}
