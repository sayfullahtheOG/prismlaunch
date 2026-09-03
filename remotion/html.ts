import { countText, typedText } from "./reveal";

/**
 * A component from the product, alive on the frame.
 *
 * An `html` clip is a snippet an agent rebuilt from the product's own
 * source. Two things happen to it before it is drawn. It is sanitised:
 * nothing in it may run, load, or navigate, because the film lives in a
 * repository and a snippet is text anyone could have written. And it is
 * made live: a few data attributes, written by the agent, are turned into
 * inline styles for the current frame — a row arriving at frame 12, a
 * button pressed at frame 40, a number counting up — so the snippet moves
 * in the export exactly as it did in the preview. Both are string
 * functions, so a test can ask what frame twelve looks like.
 *
 * The attributes:
 *
 *   data-in="F [pop|rise|fade|blur]"  arrives at frame F over 6 frames
 *   data-out="F"                       leaves at frame F over 5 frames
 *   data-press="F"                     dips once at frame F — a click
 *   data-lift="F"                      lifts from frame F — a hover
 *   data-count="F"                     its number counts up from frame F over 30
 *   data-type="F"                      its text types from frame F, 2 frames a character
 *
 * The wrapper also carries `--frame`, so a snippet's own CSS can move with
 * the film (`opacity: clamp(0, calc((var(--frame) - 12) / 6), 1)`).
 */

const FORBIDDEN = "script|iframe|object|embed|link|meta|base|form|frame|frameset|applet|svg\\s+onload";

/** Nothing that runs, loads, or navigates survives. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(new RegExp(`<\\s*(${FORBIDDEN})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`<\\s*\\/?\\s*(${FORBIDDEN})\\b[^>]*>`, "gi"), "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|xlink:href|action|formaction|poster)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '$1="#"')
    .replace(/url\(\s*(['"]?)\s*javascript:[^)]*\)/gi, "none")
    .replace(/@import[^;]*;/gi, "")
    .replace(/expression\s*\(/gi, "no(");
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOut(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

/** Elements that need `display: inline-block` before a transform does anything. */
const INLINE = new Set(["span", "a", "em", "strong", "b", "i", "small", "code", "label", "kbd"]);

type Live = { opacity: number; transforms: string[]; filters: string[]; extra: string[] };

function arrival(style: string, p: number, live: Live): void {
  const away = 1 - p;
  live.opacity *= p;
  switch (style) {
    case "fade":
      return;
    case "rise":
      if (away > 0) live.transforms.push(`translateY(${(away * 12).toFixed(2)}px)`);
      return;
    case "blur":
      if (away > 0) live.filters.push(`blur(${(away * 6).toFixed(2)}px)`);
      return;
    default:
      if (away > 0) {
        live.transforms.push(`scale(${(1 + away * 0.12).toFixed(4)})`);
        live.filters.push(`blur(${(away * 5).toFixed(2)}px)`);
      }
  }
}

/**
 * The snippet at one frame: data attributes turned into inline styles, its
 * counters and typing advanced, and its `assets/` paths resolved to the
 * URLs the renderer has. Pure, and cheap enough to run every frame.
 */
export function liveHtml(
  html: string,
  frame: number,
  assets: Readonly<Record<string, string>> = {},
): string {
  return html.replace(/<([a-zA-Z][\w-]*)([^>]*)>([^<]*)/g, (whole, tag: string, attrs: string, text: string) => {
    const attr = (name: string): string | null => {
      const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs);
      return match ? (match[1] ?? match[2] ?? "") : null;
    };
    const live: Live = { opacity: 1, transforms: [], filters: [], extra: [] };
    let touched = false;
    let body = text;

    const enters = attr("data-in");
    if (enters !== null) {
      const [at, style = "pop"] = enters.trim().split(/\s+/);
      arrival(style ?? "pop", easeOut(clamp01((frame - Number(at)) / 6)), live);
      touched = true;
    }

    const leaves = attr("data-out");
    if (leaves !== null) {
      const p = clamp01((frame - Number(leaves)) / 5);
      if (p > 0) {
        live.opacity *= 1 - p;
        live.transforms.push(`scale(${(1 - p * 0.1).toFixed(4)})`);
      }
      touched = true;
    }

    const press = attr("data-press");
    if (press !== null) {
      const since = frame - Number(press);
      if (since >= 0 && since < 8) {
        live.transforms.push(`scale(${(1 - 0.08 * Math.sin((since / 8) * Math.PI)).toFixed(4)})`);
      }
      touched = true;
    }

    const lift = attr("data-lift");
    if (lift !== null) {
      const p = easeOut(clamp01((frame - Number(lift)) / 6));
      if (p > 0) {
        live.transforms.push(`translateY(${(-3 * p).toFixed(2)}px) scale(${(1 + 0.03 * p).toFixed(4)})`);
        live.extra.push(`box-shadow:0 ${(12 * p).toFixed(1)}px ${(28 * p).toFixed(1)}px rgba(15,23,60,${(0.18 * p).toFixed(3)})`);
      }
      touched = true;
    }

    const count = attr("data-count");
    if (count !== null && body.trim()) {
      body = countText(body, clamp01((frame - Number(count)) / 30));
    }

    const type = attr("data-type");
    if (type !== null && body.trim()) {
      const chars = [...body].length;
      body = typedText(body, clamp01((frame - Number(type)) / Math.max(1, chars * 2)));
    }

    let out = attrs.replace(
      /(src|href|poster)\s*=\s*"(assets\/[^"]+)"/g,
      (m, key: string, path: string) => (assets[path] ? `${key}="${assets[path]}"` : m),
    );

    if (touched) {
      const rules = [`opacity:${live.opacity.toFixed(4)}`];
      if (live.transforms.length > 0) {
        rules.push(`transform:${live.transforms.join(" ")}`);
        if (INLINE.has(tag.toLowerCase())) rules.push("display:inline-block");
      }
      if (live.filters.length > 0) rules.push(`filter:${live.filters.join(" ")}`);
      rules.push(...live.extra);
      const style = rules.join(";");
      const existing = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(out);
      if (existing) {
        const previous = existing[1] ?? existing[2] ?? "";
        out = out.replace(existing[0], ` style="${previous.replace(/;?\s*$/, "")};${style}"`);
      } else {
        out = `${out} style="${style}"`;
      }
    }

    return `<${tag}${out}>${body}`;
  });
}
