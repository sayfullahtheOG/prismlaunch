import type { StoryboardVisual } from "@/types/prism";
import type { ReactNode } from "react";
import { boardPoseAt } from "@/lib/studio/storyboard";

/** A frame of the rough. Shared by board previews, the scrubber and the renderer. */
export function StoryboardScene({ visual, frame, width, height, assets, label = "Shot composition", renderImage }: {
  visual: StoryboardVisual;
  frame: number;
  width: number;
  height: number;
  assets: Readonly<Record<string, string>>;
  label?: string;
  renderImage?: (src: string, fit: "contain" | "cover") => ReactNode;
}) {
  const palette = visual.background === "dark"
    ? { ground: "#16181C", ink: "#F3F4F6", paper: "#262A30", muted: "#717987", line: "#A4ADB9" }
    : { ground: "#F1F3F5", ink: "#222831", paper: "#FFFFFF", muted: "#7A8696", line: "#596879" };
  return (
    <div role="img" aria-label={label} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: palette.ground }}>
      {visual.layers.map((layer) => {
        const pose = boardPoseAt(layer, frame);
        if (pose.opacity === 0) return null;
        const w = pose.width * width;
        const h = pose.height * height;
        const fill = layer.tone === "outline" ? "none" : palette[layer.tone];
        const ink = layer.tone === "ink" ? palette.ground : palette.ink;
        const url = layer.src ? assets[layer.src] : undefined;
        const fontSize = layer.fontSize * height;
        const stroke = Math.max(1.5, height * 0.003);
        return (
          <div key={layer.id} data-board-layer={layer.id} style={{ position: "absolute", left: `${pose.x * 100}%`, top: `${pose.y * 100}%`, width: `${pose.width * 100}%`, height: `${pose.height * 100}%`, opacity: pose.opacity, transform: `translate(-50%, -50%) rotate(${pose.rotation}deg)` }}>
            <svg viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} width="100%" height="100%" style={{ display: "block", overflow: "visible" }} aria-hidden>
              <title>{layer.label}</title>
              {layer.kind === "cursor" ? (
                <svg x={-w / 2} y={-h / 2} width={w} height={h} viewBox="0 0 24 32"><path d="M3 2L3 25L9 20L14 30L19 28L14 18L22 18Z" fill={palette.ink} stroke={palette.paper} strokeWidth="1.6" /></svg>
              ) : layer.kind === "arrow" ? (
                <g fill="none" stroke={palette.ink} strokeWidth={stroke * 1.6} strokeLinecap="round" strokeLinejoin="round"><path d={`M${-w / 2} 0 H${w / 2} M${w / 2 - Math.min(w * .25, h / 2)} ${-h / 2} L${w / 2} 0 L${w / 2 - Math.min(w * .25, h / 2)} ${h / 2}`} /></g>
              ) : layer.kind === "text" ? (
                <BoardText text={layer.text ?? ""} w={w} h={h} size={fontSize} fill={layer.tone === "muted" ? palette.muted : palette.ink} />
              ) : (
                <>
                  {layer.kind === "image" && url ? null : layer.kind === "ellipse" ? <ellipse rx={w / 2} ry={h / 2} fill={fill} stroke={palette.line} strokeWidth={stroke} /> : <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={layer.kind === "phone" ? w * .1 : Math.min(8, h * .06)} fill={fill} stroke={palette.line} strokeWidth={stroke} />}
                  {!url ? <BoardText text={layer.src ? `Missing image\n${layer.label}` : layer.text ?? layer.label} w={w * .85} h={h * .75} size={Math.min(fontSize, h * .18)} fill={ink} /> : null}
                  {layer.kind === "browser" ? <g stroke={palette.line} fill={palette.muted} strokeWidth={stroke}><path d={`M${-w / 2} ${-h / 2 + h * .12} H${w / 2}`} />{[.04, .07, .10].map((x) => <circle key={x} cx={-w / 2 + w * x} cy={-h / 2 + h * .06} r={h * .014} stroke="none" />)}</g> : null}
                  {layer.kind === "phone" ? <rect x={-w * .12} y={-h / 2 + h * .02} width={w * .24} height={h * .018} rx={h * .009} fill={palette.muted} /> : null}
                </>
              )}
            </svg>
            {url ? <div style={{ position: "absolute", left: `${stroke / w * 100}%`, right: `${stroke / w * 100}%`, top: layer.kind === "browser" ? "12%" : layer.kind === "phone" ? "6%" : `${stroke / h * 100}%`, bottom: `${stroke / h * 100}%`, overflow: "hidden" }}>
              {renderImage ? renderImage(url, layer.fit) : (
                // Local blob URLs cannot go through Next image optimization.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={layer.label} style={{ width: "100%", height: "100%", objectFit: layer.fit, display: "block" }} />
              )}
            </div> : null}
          </div>
        );
      })}
    </div>
  );
}

/** Wrap rough labels to their actual boxes instead of letting long copy escape. */
function BoardText({ text, w, h, size, fill }: { text: string; w: number; h: number; size: number; fill: string }) {
  const clean = text.replace(/\*/g, "");
  const limit = Math.max(3, Math.floor(w / (size * .56)));
  const lines = clean.split("\n").flatMap((paragraph) => {
    const result: string[] = [];
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line && line.length + word.length + 1 > limit) { result.push(line); line = ""; }
      // Also wrap unbroken URLs at narrow sizes.
      const pieces = word.match(new RegExp(`.{1,${limit}}`, "g")) ?? [""];
      pieces.forEach((piece, index) => {
        if (index > 0) { result.push(line); line = ""; }
        line += `${line ? " " : ""}${piece}`;
      });
    }
    result.push(line);
    return result;
  });
  const fitted = Math.min(size, h / Math.max(1, lines.length * 1.25));
  return <text textAnchor="middle" fill={fill} fontFamily="Arial, sans-serif" fontSize={fitted} fontWeight={500}>{lines.map((line, index) => <tspan key={index} x={0} y={(index - (lines.length - 1) / 2) * fitted * 1.25 + fitted * .35}>{line}</tspan>)}</text>;
}
