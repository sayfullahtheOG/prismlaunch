/**
 * Which frames to capture, and how to lay them out.
 *
 * An agent that cannot see its own work is guessing. A video is the worst
 * case: a screenshot of a playing film lands wherever the clock happened to
 * be. But this film is a Remotion composition — every frame is a pure
 * function of time — so "one frame per second between six and nine seconds"
 * is not a timing problem, it is a list of frame numbers, and each renders
 * to exactly the pixels export will produce. This module turns the request
 * into that list and the list into a grid. The rendering itself is in
 * web-capture.ts, because it needs a browser.
 *
 * Pure so it can be tested without one.
 */

export type CaptureRequest = {
  fps: number;
  durationInFrames: number;
  /** Seconds between captures. Ignored when `at` is given. */
  every?: number | undefined;
  /** Window, in seconds. Defaults to the whole film. */
  from?: number | undefined;
  to?: number | undefined;
  /** Exact moments, in seconds. Wins over the cadence. */
  at?: readonly number[] | undefined;
  /** Hard ceiling on how many frames one call may ask for. */
  max: number;
};

export type CapturePlan = {
  /** Frame numbers, ascending, unique, within the film. */
  frames: number[];
  /** True when the cadence produced more than `max` and the tail was dropped. */
  truncated: boolean;
  /** Where the plan started and ended, in seconds, for the label. */
  from: number;
  to: number;
};

export const MAX_CAPTURE_FRAMES = 24;

/**
 * Six frames to a sheet, three across, like a storyboard page.
 *
 * A vision model pays for an image by its area after it has been shrunk to
 * fit the model's limit, not by how many frames are on it — so packing
 * twenty-four frames onto one sheet does not save tokens, it spends the same
 * tokens on frames too small to read. Six at 480px is a sheet under 1500px
 * wide, which the common models take without shrinking, and it is the same
 * grid the storyboard stage uses, so the agent already knows how to read it.
 */
export const FRAMES_PER_SHEET = 6;

/**
 * Split a plan into pages, in order: six to a sheet, or one per image when
 * the agent asks for single frames.
 */
export function pageFrames(frames: readonly number[], perPage = FRAMES_PER_SHEET): number[][] {
  const size = Math.max(1, perPage);
  const pages: number[][] = [];
  for (let start = 0; start < frames.length; start += size) {
    pages.push(frames.slice(start, start + size));
  }
  return pages;
}

export type CaptureLayout = "sheet" | "single";

/** Cell width when the agent does not say: a sheet reads at 480, one frame deserves the full 960. */
export function defaultCellWidth(layout: CaptureLayout): number {
  return layout === "single" ? 960 : 480;
}

export function planCapture(request: CaptureRequest): CapturePlan {
  const { fps, durationInFrames, max } = request;
  const lastFrame = Math.max(0, durationInFrames - 1);
  const filmSeconds = lastFrame / fps;
  const clampFrame = (frame: number) => Math.min(lastFrame, Math.max(0, Math.round(frame)));

  if (request.at && request.at.length > 0) {
    const frames = unique(request.at.map((seconds) => clampFrame(seconds * fps)));
    const kept = frames.slice(0, max);
    return {
      frames: kept,
      truncated: frames.length > kept.length,
      from: (kept[0] ?? 0) / fps,
      to: (kept[kept.length - 1] ?? 0) / fps,
    };
  }

  const from = Math.max(0, Math.min(request.from ?? 0, filmSeconds));
  const to = Math.max(from, Math.min(request.to ?? filmSeconds, filmSeconds));
  const every = Math.max(1 / fps, request.every ?? 1);

  const frames: number[] = [];
  // Step in seconds and round each to a frame, rather than stepping in
  // frames, so "every 0.5s at 30fps" lands on 0, 15, 30 and not on drift.
  for (let step = 0; ; step += 1) {
    const seconds = from + step * every;
    if (seconds > to + 1e-9) break;
    frames.push(clampFrame(seconds * fps));
    if (frames.length > max) break;
  }

  const all = unique(frames);
  const kept = all.slice(0, max);
  return {
    frames: kept,
    truncated: all.length > kept.length,
    from,
    to: (kept[kept.length - 1] ?? clampFrame(from * fps)) / fps,
  };
}

function unique(frames: number[]): number[] {
  return [...new Set(frames)].sort((a, b) => a - b);
}

/** `0:06.50` — minutes, seconds, hundredths. Reads at a glance under a thumbnail. */
export function timecode(frame: number, fps: number): string {
  const total = frame / fps;
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

export type SheetLayout = {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  /** Height of the caption strip under each cell. */
  labelHeight: number;
  /** Height of the strip along the bottom that names the sheet. */
  footerHeight: number;
  gutter: number;
  width: number;
  height: number;
  /** Top-left of each cell's image area, in plan order. */
  cells: { x: number; y: number }[];
};

/**
 * A storyboard page: three across, two down, read left to right then top to
 * bottom. Fewer than three frames do not pad out to three columns.
 */
export function sheetLayout(
  count: number,
  cellWidth: number,
  aspect: number,
  columnsWanted = 3,
): SheetLayout {
  const columns = Math.max(1, Math.min(columnsWanted, count));
  const rows = Math.max(1, Math.ceil(count / columns));
  const cellHeight = Math.max(1, Math.round(cellWidth / aspect));
  const labelHeight = 22;
  const footerHeight = 22;
  const gutter = 8;
  const cells: { x: number; y: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    cells.push({
      x: gutter + column * (cellWidth + gutter),
      y: gutter + row * (cellHeight + labelHeight + gutter),
    });
  }
  return {
    columns,
    rows,
    cellWidth,
    cellHeight,
    labelHeight,
    footerHeight,
    gutter,
    width: gutter + columns * (cellWidth + gutter),
    height: gutter + rows * (cellHeight + labelHeight + gutter) + footerHeight,
    cells,
  };
}

/** `003` — the board number, so the agent can say "frame 3" and mean one cell. */
export function boardNumber(index: number): string {
  return String(index + 1).padStart(3, "0");
}
