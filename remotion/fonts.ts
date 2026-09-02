import { loadFont as loadInstrumentSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";

/**
 * Fonts for the film.
 *
 * Loaded through @remotion/google-fonts rather than next/font so the *server*
 * render resolves the same faces the browser does. A font that only exists in
 * the browser is the most common cause of a preview and an export disagreeing,
 * and it is invisible until you watch the MP4.
 *
 * Weights and subsets are pinned deliberately. Calling `loadFont()` bare pulls
 * every weight and every subset — measured at 126 requests for Inter and 96
 * for JetBrains Mono — which is slow in the browser and worse inside a render
 * sandbox that pays for every second. The film uses three weights of Latin
 * text and nothing else.
 */

const LATIN = ["latin"] as const;

const display = loadInstrumentSerif("normal", {
  weights: ["400"],
  subsets: [...LATIN],
});

const body = loadInter("normal", {
  weights: ["400", "600", "700"],
  subsets: [...LATIN],
});

const mono = loadJetBrainsMono("normal", {
  weights: ["400"],
  subsets: [...LATIN],
});

export const FONT_DISPLAY = display.fontFamily;
export const FONT_BODY = body.fontFamily;
export const FONT_MONO = mono.fontFamily;

/** Awaited by the render entrypoint before the first frame is drawn. */
export function waitForFonts(): Promise<unknown> {
  return Promise.all([
    display.waitUntilDone(),
    body.waitUntilDone(),
    mono.waitUntilDone(),
  ]);
}
