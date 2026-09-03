import { Audio, Video } from "@remotion/media";
import {
  AbsoluteFill,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FONT_STACK, VARIABLE_WEIGHT } from "./fonts";
import { liveHtml, sanitizeHtml } from "./html";
import { drawProgress, ICON_PATHS } from "./icons";
import {
  boxStyle,
  cameraState,
  cameraTransform,
  clipStyle,
  fadeGain,
  motionState,
  type ClipStyle,
  type MotionState,
} from "./motion";
import { particlesAt } from "./particles";
import {
  caretVisible,
  markedWords,
  revealProgress,
  revealed,
  stripAccents,
  wordProgressAt,
} from "./reveal";
import type {
  AudioClip,
  Background,
  Clip,
  DeviceClip,
  HtmlClip,
  IconClip,
  ImageClip,
  ParticlesClip,
  ProjectFile,
  ShapeClip,
  TextClip,
  Track,
  VideoClip,
  VisualClip,
} from "@/types/prism";

/**
 * The composition root.
 *
 * Receives a complete file — no store, no fetch, no clock. The `<Player>` and
 * the WebCodecs renderer mount this exact component with the same props, which
 * is what makes the export provably match the preview.
 *
 * There is no scene vocabulary here any more. The film is a background and a
 * stack of tracks, and this walks them: the first visual track paints last, so
 * `tracks[0]` is in front, matching the timeline read top to bottom. The
 * camera sits over the whole visual stack and under nothing.
 *
 * Assets are passed in resolved. Clips carry a path like `assets/logo.png`, but
 * this component never touches a filesystem — the app turns handles into object
 * URLs and hands over a map. That keeps the renderer a pure function of its
 * props, which is what lets Remotion Studio open it with an empty map.
 */

export type AssetMap = Readonly<Record<string, string>>;

export type FilmProps = {
  file: ProjectFile;
  assets: AssetMap;
};

export function Film({ file, assets }: FilmProps) {
  const visual = file.tracks.filter((track) => track.kind === "visual");
  const audio = file.tracks.filter((track) => track.kind === "audio");

  return (
    <AbsoluteFill style={backgroundStyle(file.background)}>
      <Camera moves={file.camera}>
        {/*
         * Reversed: later siblings paint over earlier ones, and tracks[0] is the
         * front of the stack. Reversing here rather than storing the array
         * backwards keeps the file readable — top of the list is top of the
         * picture, in the JSON and in the timeline.
         */}
        {[...visual].reverse().map((track) => (
          <TrackLayer key={track.id} track={track} assets={assets} />
        ))}
      </Camera>

      {audio.map((track) => (
        <TrackLayer key={track.id} track={track} assets={assets} />
      ))}
    </AbsoluteFill>
  );
}

/**
 * The camera over the picture.
 *
 * One transform on one wrapper: the point the camera looks at is moved to
 * the centre, then the whole picture is scaled about it. Nothing inside
 * knows the camera exists, which is what makes a push-in cost nothing to
 * author — the clips are where they are, and the camera goes to them.
 */
function Camera({
  moves,
  children,
}: {
  moves: ProjectFile["camera"];
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // A film written before the camera existed, or a snapshot that copied
  // the file field by field, has no `camera`: that is a still camera, not
  // a crash in the middle of an export.
  if (!moves || moves.length === 0) return <>{children}</>;
  const transform = cameraTransform(cameraState(moves, frame), width, height);
  return (
    <AbsoluteFill style={transform ? { transform, transformOrigin: "50% 50%" } : undefined}>
      {children}
    </AbsoluteFill>
  );
}

function backgroundStyle(background: Background): React.CSSProperties {
  if (background.kind === "solid") {
    return { backgroundColor: background.color };
  }
  return {
    backgroundImage: `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`,
  };
}

function TrackLayer({ track, assets }: { track: Track; assets: AssetMap }) {
  // A hidden visual track draws nothing; a muted audio track plays nothing.
  // One flag, because they are the same intent.
  if (track.hidden) return null;

  return (
    <>
      {track.clips.map((clip) => (
        <Sequence
          key={clip.id}
          from={clip.from}
          durationInFrames={clip.durationInFrames}
          // Named so the Remotion Studio timeline is legible while debugging.
          name={clip.label ?? clipSummary(clip)}
          layout="none"
        >
          <ClipRenderer clip={clip} assets={assets} volume={track.volume} />
        </Sequence>
      ))}
    </>
  );
}

function ClipRenderer({
  clip,
  assets,
  volume,
}: {
  clip: Clip;
  assets: AssetMap;
  volume: number;
}) {
  if (clip.kind === "audio") {
    return <AudioLayer clip={clip} assets={assets} trackVolume={volume} />;
  }
  return <VisualLayer clip={clip} assets={assets} trackVolume={volume} />;
}

/** The frames a trail's ghosts lag behind, nearest last so it paints on top. */
const TRAIL = [10, 8, 6, 4, 2] as const;

function VisualLayer({
  clip,
  assets,
  trackVolume,
}: {
  clip: VisualClip;
  assets: AssetMap;
  trackVolume: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = clipStyle(clip.animation, clip.box, frame, clip.durationInFrames, fps);
  const move = motionState(clip.motion, frame, clip.durationInFrames);

  // A trail is the same clip a few frames ago, faint, a few times over. A
  // video would mean five decoders for a streak, so it goes without one.
  const trail =
    clip.motion.trail && clip.kind !== "video"
      ? TRAIL.map((back, index) => ({
          back,
          state: motionState(clip.motion, frame - back, clip.durationInFrames),
          fade: 0.08 + index * 0.06,
        }))
      : [];

  return (
    <>
      {trail.map((ghost) => (
        <Placed
          key={ghost.back}
          clip={clip}
          assets={assets}
          trackVolume={trackVolume}
          style={style}
          move={ghost.state}
          fade={ghost.fade}
          softer={ghost.back * 0.4}
        />
      ))}
      <Placed
        clip={clip}
        assets={assets}
        trackVolume={trackVolume}
        style={style}
        move={move}
        fade={1}
        softer={0}
      />
    </>
  );
}

/**
 * One visual clip at one place: its box, its transitions, its move, its
 * tilt, and the depth it was given — the shadow under it, the light around
 * it, the focus it is held at. All of that is one transform and one filter
 * on one element; the body inside knows nothing about any of it.
 */
function Placed({
  clip,
  assets,
  trackVolume,
  style,
  move,
  fade,
  softer,
}: {
  clip: VisualClip;
  assets: AssetMap;
  trackVolume: number;
  style: ClipStyle;
  move: MotionState;
  /** A multiplier on the opacity: 1 for the clip, less for a ghost of it. */
  fade: number;
  /** Extra defocus in pixels, for a ghost. */
  softer: number;
}) {
  const { height } = useVideoConfig();

  // The move shifts the box itself, so a cursor that travels is laid out
  // where it is, not transformed from where it was; the scale rides on the
  // transform with the transitions, which is what keeps text crisp.
  const box =
    move.dx === 0 && move.dy === 0
      ? clip.box
      : { ...clip.box, x: clip.box.x + move.dx, y: clip.box.y + move.dy };

  const tilted = clip.box.tiltX !== 0 || clip.box.tiltY !== 0;
  const flips = clip.animation.enter === "flip" || clip.animation.exit === "flip";
  const transform = [
    // A perspective has to come first in the list to give the rotations
    // depth; without one, a tilt is a squash.
    tilted || flips ? `perspective(${Math.round(height * 1.4)}px)` : "",
    clip.box.tiltX !== 0 ? `rotateX(${clip.box.tiltX}deg)` : "",
    clip.box.tiltY !== 0 ? `rotateY(${clip.box.tiltY}deg)` : "",
    style.transform,
    move.scale !== 1 ? `scale(${move.scale})` : "",
    move.rotate !== 0 ? `rotate(${move.rotate}deg)` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const defocus = (clip.blur + move.blur) * 0.04 * height + softer;
  const filter = [
    style.filter,
    defocus > 0 ? `blur(${defocus.toFixed(2)}px)` : "",
    clip.shadow > 0
      ? `drop-shadow(0 ${(clip.shadow * 0.025 * height).toFixed(1)}px ${(clip.shadow * 0.06 * height).toFixed(1)}px rgba(15, 23, 60, ${(0.14 + clip.shadow * 0.22).toFixed(2)}))`
      : "",
    clip.glow > 0
      ? `drop-shadow(0 0 ${(clip.glow * 0.035 * height).toFixed(1)}px ${withAlpha(ownColor(clip), 0.75)})`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      style={{
        ...boxStyle(box),
        opacity: style.opacity * move.opacity * fade,
        transform: transform || undefined,
        transformStyle: tilted || flips ? "preserve-3d" : undefined,
        ...(filter ? { filter } : {}),
        ...(style.clipPath ? { clipPath: style.clipPath } : {}),
      }}
    >
      {clip.kind === "text" ? <TextBody clip={clip} /> : null}
      {clip.kind === "shape" ? <ShapeBody clip={clip} /> : null}
      {clip.kind === "image" ? <ImageBody clip={clip} assets={assets} /> : null}
      {clip.kind === "video" ? (
        <VideoBody clip={clip} assets={assets} trackVolume={trackVolume} />
      ) : null}
      {clip.kind === "icon" ? <IconBody clip={clip} /> : null}
      {clip.kind === "particles" ? <ParticlesBody clip={clip} /> : null}
      {clip.kind === "device" ? <DeviceBody clip={clip} assets={assets} /> : null}
      {clip.kind === "html" ? <HtmlBody clip={clip} assets={assets} /> : null}
    </div>
  );
}

/**
 * A component from the product, scaled to the box.
 *
 * The snippet is laid out at the width it was written for and scaled so
 * that width fills the box, anchored at the top-left; its height is its
 * own. The film's three faces are handed in as CSS variables, and the
 * frame as `--frame`, so the snippet can be set in the product's type and
 * move with the film. Everything in it has already been through
 * `sanitizeHtml` and `liveHtml`.
 */
function HtmlBody({ clip, assets }: { clip: HtmlClip; assets: AssetMap }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const scale = (clip.box.width * width) / clip.width;
  const markup = liveHtml(sanitizeHtml(clip.html), frame, assets);
  const style = {
    position: "absolute",
    left: 0,
    top: 0,
    width: clip.width,
    transform: `scale(${scale})`,
    transformOrigin: "0 0",
    fontFamily: FONT_STACK.body,
    color: "#111114",
    lineHeight: 1.3,
    "--frame": String(frame),
    "--font-display": FONT_STACK.display,
    "--font-body": FONT_STACK.body,
    "--font-mono": FONT_STACK.mono,
  } as React.CSSProperties;
  return <div style={style} dangerouslySetInnerHTML={{ __html: markup }} />;
}

/** The colour a glow takes: the thing's own. */
function ownColor(clip: VisualClip): string {
  switch (clip.kind) {
    case "text":
      return clip.accent ?? clip.color;
    case "shape":
      return clip.fillTo ?? clip.fill;
    case "icon":
      return clip.color;
    case "particles":
      return clip.colors[0] ?? "#FFFFFF";
    case "device":
      return clip.screen;
    default:
      return "#FFFFFF";
  }
}

/** `#RRGGBB` with an alpha; an eight-digit colour keeps its own. */
function withAlpha(hex: string, alpha: number): string {
  if (hex.length === 9) return hex;
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

/** A corner radius in pixels, as a fraction of the box's shorter side, so 0.5 is a true pill and not an ellipse. */
function cornerPx(radius: number, box: Pick<VisualClip["box"], "width" | "height">, width: number, height: number): number {
  return radius * Math.min(box.width * width, box.height * height);
}

function TextBody({ clip }: { clip: TextClip }) {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent:
          clip.align === "left"
            ? "flex-start"
            : clip.align === "right"
              ? "flex-end"
              : "center",
        textAlign: clip.align,
        // Font size is a fraction of canvas height, so a composition renders
        // identically at 720p and 4K. This is the only place that becomes px.
        fontSize: height * clip.fontSize,
        fontFamily: FONT_STACK[clip.fontFamily],
        fontWeight: VARIABLE_WEIGHT[clip.fontFamily] ? clip.fontWeight : 400,
        color: clip.color,
        lineHeight: clip.lineHeight,
        letterSpacing: `${clip.letterSpacing}em`,
        whiteSpace: "pre-wrap",
        // Long words should break rather than bleed outside the box someone
        // positioned deliberately.
        overflowWrap: "anywhere",
        // A fill makes the box a button or a chip: the words sit in it with
        // a little air on either side.
        ...(clip.fill
          ? {
              background: clip.fill,
              borderRadius: cornerPx(clip.radius, clip.box, width, height),
              padding: "0 0.8em",
              boxSizing: "border-box" as const,
            }
          : {}),
      }}
    >
      <span style={{ width: "100%" }}>
        <Words clip={clip} frame={frame} fps={fps} />
      </span>
    </div>
  );
}

/**
 * The words at one frame: all of them, or as many as the reveal has let in.
 *
 * `words` lays every word out from the first frame and brings each in
 * where it already is, so the line never reflows as it arrives; the
 * starred words are the accent's. The caret is a block of the text's own
 * colour, an em tall, after whatever is showing. Shared with the Library's
 * tiles, so a preview types what the film types.
 */
export function Words({
  clip,
  frame,
  fps,
}: {
  clip: Pick<TextClip, "text" | "reveal" | "revealFrames" | "caret"> &
    Partial<Pick<TextClip, "accent" | "revealStagger" | "revealStyle">>;
  frame: number;
  fps: number;
}) {
  const progress = revealProgress(frame, clip.revealFrames);
  const typing = clip.reveal === "type" && progress < 1;
  const caret = clip.caret ? <Caret visible={caretVisible(frame, fps, typing)} /> : null;
  const accent = clip.accent;

  if (clip.reveal === "words") {
    const parts = markedWords(clip.text);
    const count = parts.filter((part) => !part.space).length;
    const stagger = clip.revealStagger ?? 0;
    const style = clip.revealStyle ?? "rise";
    let index = 0;
    return (
      <>
        {parts.map((part, at) => {
          if (part.space) return part.part;
          const p = wordProgressAt(index++, count, frame, clip.revealFrames, stagger);
          return (
            <span
              key={at}
              style={{
                display: "inline-block",
                opacity: p,
                ...(accent && part.accent ? { color: accent } : {}),
                ...wordArrival(style, p),
              }}
            >
              {part.part}
            </span>
          );
        })}
        {caret}
      </>
    );
  }

  // Typing and counting print one colour: the stars come out, the words go in.
  if (clip.reveal === "type" || clip.reveal === "count") {
    return (
      <>
        {revealed(clip.reveal, stripAccents(clip.text), progress)}
        {caret}
      </>
    );
  }

  return (
    <>
      {markedWords(clip.text).map((part, at) =>
        accent && part.accent ? (
          <span key={at} style={{ color: accent }}>
            {part.part}
          </span>
        ) : (
          part.part
        ),
      )}
      {caret}
    </>
  );
}

/** What a word looks like partway in, by style. `p` is 1 when it has landed. */
function wordArrival(style: TextClip["revealStyle"], p: number): React.CSSProperties {
  if (p >= 1) return {};
  const away = 1 - p;
  switch (style) {
    case "fade":
      return {};
    case "rise":
      return { transform: `translateY(${away * 0.35}em)` };
    case "pop":
      return { transform: `scale(${1 + away * 0.18})`, filter: `blur(${away * 0.12}em)` };
    case "blur":
      return { filter: `blur(${away * 0.14}em)` };
  }
}

function Caret({ visible }: { visible: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: "0.08em",
        height: "0.95em",
        marginLeft: "0.06em",
        verticalAlign: "-0.12em",
        background: "currentColor",
        opacity: visible ? 1 : 0,
      }}
    />
  );
}

function ShapeBody({ clip }: { clip: ShapeClip }) {
  const { width, height } = useVideoConfig();
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: clip.fillTo
          ? `linear-gradient(${clip.fillAngle}deg, ${clip.fill}, ${clip.fillTo})`
          : clip.fill,
        borderRadius:
          clip.shape === "ellipse" ? "50%" : cornerPx(clip.radius, clip.box, width, height),
      }}
    />
  );
}

/**
 * An icon: a path in a 24-box, scaled to fit the clip's box and centred.
 * With `draw`, the stroke is dashed to its own length and the dash pulled
 * back over the enter, which is what a pen drawing it looks like; a filled
 * icon fades in over the same frames instead, since it has no stroke.
 */
function IconBody({ clip }: { clip: IconClip }) {
  const frame = useCurrentFrame();
  const shape = ICON_PATHS[clip.icon];
  const frames = clip.animation.enter === "none" ? 12 : Math.max(1, clip.animation.enterFrames);
  const drawn = clip.draw ? drawProgress(frame, frames) : 1;

  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      style={{ display: "block", overflow: "visible" }}
      aria-hidden
    >
      <path
        d={shape.d}
        pathLength={1}
        fill={shape.filled ? clip.color : "none"}
        fillOpacity={shape.filled ? drawn : undefined}
        stroke={shape.filled ? "none" : clip.color}
        strokeWidth={shape.filled ? undefined : clip.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={clip.draw && !shape.filled ? 1 : undefined}
        strokeDashoffset={clip.draw && !shape.filled ? 1 - drawn : undefined}
      />
    </svg>
  );
}

/**
 * Particles, laid out in the canvas and drawn inside the clip's box.
 *
 * `particlesAt` speaks canvas fractions; the box is only the emitter, so
 * each piece's place is turned into a percentage of the box and allowed
 * to overflow it — confetti leaves the thing it burst from.
 */
function ParticlesBody({ clip }: { clip: ParticlesClip }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const pieces = particlesAt(clip, frame, clip.durationInFrames, width / height);
  const left = clip.box.x - clip.box.width / 2;
  const top = clip.box.y - clip.box.height / 2;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {pieces.map((piece, index) => {
        const h = piece.size * height;
        const w = h * piece.aspect;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: `${((piece.x - left) / clip.box.width) * 100}%`,
              top: `${((piece.y - top) / clip.box.height) * 100}%`,
              width: w,
              height: h,
              marginLeft: -w / 2,
              marginTop: -h / 2,
              background: piece.color,
              borderRadius: piece.round ? "50%" : h * 0.12,
              opacity: piece.opacity,
              transform: piece.rotate !== 0 ? `rotate(${piece.rotate}deg)` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * A device around a screenshot.
 *
 * Four frames, each a few divs: a phone's bezel and island, a browser's
 * title bar with its three dots, a window's hairline, a card's plain
 * panel. The screenshot fills the screen; without one the screen is a
 * colour, which is what a board of a product looks like before the
 * product arrives.
 */
function DeviceBody({ clip, assets }: { clip: DeviceClip; assets: AssetMap }) {
  const { width, height } = useVideoConfig();
  const url = clip.src ? assets[clip.src] ?? null : null;
  const boxW = clip.box.width * width;
  const boxH = clip.box.height * height;
  const radius = cornerPx(clip.radius, clip.box, width, height);

  const screen = (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: clip.screen,
        overflow: "hidden",
      }}
    >
      {url ? (
        <Img
          src={url}
          style={{ width: "100%", height: "100%", objectFit: clip.fit, display: "block" }}
        />
      ) : null}
    </div>
  );

  switch (clip.device) {
    case "phone": {
      const bezel = Math.max(2, boxW * 0.035);
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: clip.frame,
            borderRadius: Math.max(radius, boxW * 0.14),
            boxShadow: `inset 0 0 0 ${Math.max(1, bezel * 0.35)}px rgba(255,255,255,0.08)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: bezel,
              borderRadius: Math.max(radius, boxW * 0.14) - bezel,
              overflow: "hidden",
            }}
          >
            {screen}
          </div>
          {/* The island. */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: bezel + boxH * 0.012,
              width: boxW * 0.28,
              height: boxW * 0.075,
              marginLeft: -boxW * 0.14,
              borderRadius: 999,
              background: clip.frame,
            }}
          />
        </div>
      );
    }
    case "browser": {
      const bar = Math.max(6, boxH * 0.075);
      const dot = Math.max(2, bar * 0.28);
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: clip.frame,
            borderRadius: radius,
            overflow: "hidden",
            boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: bar,
              display: "flex",
              alignItems: "center",
              gap: dot * 0.7,
              paddingLeft: dot * 1.6,
            }}
          >
            {["#FF5F57", "#FEBC2E", "#28C840"].map((light) => (
              <span
                key={light}
                style={{ width: dot, height: dot, borderRadius: "50%", background: light }}
              />
            ))}
            <span
              style={{
                marginLeft: dot * 1.4,
                height: bar * 0.5,
                width: "38%",
                borderRadius: 999,
                background: "rgba(255,255,255,0.12)",
              }}
            />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: bar, bottom: 0 }}>{screen}</div>
        </div>
      );
    }
    case "window":
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            overflow: "hidden",
            boxShadow: `inset 0 0 0 1px ${withAlpha(clip.frame, 0.35)}`,
          }}
        >
          {screen}
        </div>
      );
    case "card":
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            overflow: "hidden",
            background: clip.screen,
            boxShadow: `inset 0 0 0 1px rgba(17, 17, 20, 0.08)`,
          }}
        >
          {url ? (
            <div style={{ position: "absolute", inset: "6% 6% 22% 6%", borderRadius: radius * 0.7, overflow: "hidden" }}>
              <Img src={url} style={{ width: "100%", height: "100%", objectFit: clip.fit, display: "block" }} />
            </div>
          ) : null}
        </div>
      );
  }
}

/**
 * A missing asset draws nothing rather than throwing.
 *
 * The file is edited by hand in someone's repository, so a path that no longer
 * resolves is an ordinary Tuesday — a renamed file, a `git clean`, a typo. A
 * crashed render would take the whole film down over one image; a hole in the
 * frame is recoverable and the app reports the missing path separately.
 */
function useAsset(assets: AssetMap, src: string): string | null {
  return assets[src] ?? null;
}

function ImageBody({ clip, assets }: { clip: ImageClip; assets: AssetMap }) {
  const url = useAsset(assets, clip.src);
  const { width, height } = useVideoConfig();
  if (!url) return null;

  return (
    <Img
      src={url}
      style={{
        width: "100%",
        height: "100%",
        objectFit: clip.fit,
        borderRadius: cornerPx(clip.radius, clip.box, width, height),
      }}
    />
  );
}

function VideoBody({
  clip,
  assets,
  trackVolume,
}: {
  clip: VideoClip;
  assets: AssetMap;
  trackVolume: number;
}) {
  const url = useAsset(assets, clip.src);
  const { width, height } = useVideoConfig();
  if (!url) return null;

  // `@remotion/media` rather than remotion's own <Video>: the WebCodecs
  // renderer that exports the film refuses the HTML5 one, and this one
  // decodes the same way in the preview and in the export.
  return (
    <Video
      src={url}
      trimBefore={clip.startFrom}
      volume={clip.volume * trackVolume}
      playbackRate={clip.playbackRate}
      objectFit={clip.fit}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: cornerPx(clip.radius, clip.box, width, height),
      }}
    />
  );
}

function AudioLayer({
  clip,
  assets,
  trackVolume,
}: {
  clip: AudioClip;
  assets: AssetMap;
  trackVolume: number;
}) {
  const url = useAsset(assets, clip.src);
  if (!url) return null;

  return (
    <Audio
      src={url}
      trimBefore={clip.startFrom}
      playbackRate={clip.playbackRate}
      // A function volume is evaluated per frame by Remotion, which is what
      // makes the fades work in the export and not just the preview.
      volume={(frame) =>
        clip.volume *
        trackVolume *
        fadeGain(
          frame,
          clip.durationInFrames,
          clip.fadeInFrames,
          clip.fadeOutFrames,
        )
      }
    />
  );
}

/** A short description for the Remotion Studio timeline and the app's clip chips. */
export function clipSummary(clip: Clip): string {
  switch (clip.kind) {
    case "text":
      return stripAccents(clip.text).slice(0, 28);
    case "shape":
      return clip.shape;
    case "icon":
      return clip.icon;
    case "particles":
      return clip.style;
    case "device":
      return clip.src ? clip.src.split("/").pop() ?? clip.device : clip.device;
    case "html":
      return "component";
    case "image":
    case "video":
    case "audio":
      return clip.src.split("/").pop() ?? clip.src;
  }
}
