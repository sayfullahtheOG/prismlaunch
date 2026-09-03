import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Video,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FONT_STACK, VARIABLE_WEIGHT } from "./fonts";
import { boxStyle, clipStyle, fadeGain, motionState } from "./motion";
import { caretVisible, isSpace, revealProgress, revealed, splitWords, wordProgress } from "./reveal";
import type {
  AudioClip,
  Background,
  Clip,
  ImageClip,
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
 * `tracks[0]` is in front, matching the timeline read top to bottom.
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
      {/*
       * Reversed: later siblings paint over earlier ones, and tracks[0] is the
       * front of the stack. Reversing here rather than storing the array
       * backwards keeps the file readable — top of the list is top of the
       * picture, in the JSON and in the timeline.
       */}
      {[...visual].reverse().map((track) => (
        <TrackLayer key={track.id} track={track} assets={assets} />
      ))}

      {audio.map((track) => (
        <TrackLayer key={track.id} track={track} assets={assets} />
      ))}
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
  const style = clipStyle(
    clip.animation,
    clip.box,
    frame,
    clip.durationInFrames,
    fps,
  );

  // The move shifts the box itself, so a cursor that travels is laid out
  // where it is, not transformed from where it was; the scale rides on the
  // transform with the transitions, which is what keeps text crisp.
  const move = motionState(clip.motion, frame, clip.durationInFrames);
  const box =
    move.dx === 0 && move.dy === 0
      ? clip.box
      : { ...clip.box, x: clip.box.x + move.dx, y: clip.box.y + move.dy };
  const transform = [style.transform, move.scale !== 1 ? `scale(${move.scale})` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      style={{
        ...boxStyle(box),
        opacity: style.opacity,
        transform: transform || undefined,
        ...(style.filter ? { filter: style.filter } : {}),
      }}
    >
      {clip.kind === "text" ? <TextBody clip={clip} /> : null}
      {clip.kind === "shape" ? <ShapeBody clip={clip} /> : null}
      {clip.kind === "image" ? <ImageBody clip={clip} assets={assets} /> : null}
      {clip.kind === "video" ? (
        <VideoBody clip={clip} assets={assets} trackVolume={trackVolume} />
      ) : null}
    </div>
  );
}

function TextBody({ clip }: { clip: TextClip }) {
  const { height, fps } = useVideoConfig();
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
 * `words` lays every word out from the first frame and fades each in where
 * it already is, so the line never reflows as it arrives. The caret is a
 * block of the text's own colour, an em tall, after whatever is showing.
 */
function Words({ clip, frame, fps }: { clip: TextClip; frame: number; fps: number }) {
  const progress = revealProgress(frame, clip.revealFrames);
  const typing = clip.reveal === "type" && progress < 1;
  const caret = clip.caret ? <Caret visible={caretVisible(frame, fps, typing)} /> : null;

  if (clip.reveal === "words") {
    const parts = splitWords(clip.text);
    const count = parts.filter((part) => !isSpace(part)).length;
    let index = 0;
    return (
      <>
        {parts.map((part, at) => {
          if (isSpace(part)) return part;
          const p = wordProgress(index++, count, progress);
          return (
            <span
              key={at}
              style={{
                display: "inline-block",
                opacity: p,
                transform: p < 1 ? `translateY(${(1 - p) * 0.35}em)` : undefined,
              }}
            >
              {part}
            </span>
          );
        })}
        {caret}
      </>
    );
  }

  return (
    <>
      {revealed(clip.reveal, clip.text, progress)}
      {caret}
    </>
  );
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
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: clip.fill,
        borderRadius:
          clip.shape === "ellipse" ? "50%" : `${clip.radius * 100}%`,
      }}
    />
  );
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
  if (!url) return null;

  return (
    <Img
      src={url}
      style={{
        width: "100%",
        height: "100%",
        objectFit: clip.fit,
        borderRadius: `${clip.radius * 100}%`,
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
  if (!url) return null;

  return (
    <Video
      src={url}
      startFrom={clip.startFrom}
      volume={clip.volume * trackVolume}
      playbackRate={clip.playbackRate}
      style={{
        width: "100%",
        height: "100%",
        objectFit: clip.fit,
        borderRadius: `${clip.radius * 100}%`,
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
      startFrom={clip.startFrom}
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
      return clip.text.slice(0, 28);
    case "shape":
      return clip.shape;
    case "image":
    case "video":
    case "audio":
      return clip.src.split("/").pop() ?? clip.src;
  }
}
