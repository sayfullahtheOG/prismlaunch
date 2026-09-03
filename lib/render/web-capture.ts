import type { ProjectFile } from "@/types/prism";
import {
  boardNumber,
  FRAMES_PER_SHEET,
  pageFrames,
  sheetLayout,
  timecode,
  type CaptureLayout,
} from "./capture-plan";

/**
 * Render chosen frames of the composition onto storyboard sheets.
 *
 * The same `Film` component the player mounts and the exporter encodes is the
 * one rendered here, through `renderStillOnWeb`, so what the agent sees is
 * what the person sees and what the file will contain. Each frame is rendered
 * at the sheet's cell size rather than full size and scaled down, which is
 * the difference between a second and ten for a dozen frames.
 *
 * Six to a sheet, numbered like boards, with the time and frame under each,
 * and a footer saying which sheet of how many. A model reads a labelled grid
 * as a sequence — this, then this, then this — and that is exactly the
 * question an animation check is asking. More than six frames means more
 * sheets, never smaller cells: the point of the sheet is to read the frames.
 *
 * Dynamically imported, like the exporter, so none of this enters the bundle
 * until an agent asks to look.
 */

export type CaptureOptions = {
  /** Six to a storyboard sheet, or one frame per image. */
  layout: CaptureLayout;
  /** Width of each cell in pixels. */
  cellWidth: number;
  format: "jpeg" | "png";
  /** For the footer. */
  title: string;
};

export type CapturedSheet = {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  /** The frames on this sheet, in cell order. */
  frames: number[];
  /** Board numbers of the first and last cell, across the whole capture. */
  firstBoard: number;
};

export type CaptureOutcome =
  | { ok: true; sheets: CapturedSheet[] }
  | { ok: false; message: string };

export async function captureSheets(
  file: ProjectFile,
  assets: Readonly<Record<string, string>>,
  frames: readonly number[],
  options: CaptureOptions,
): Promise<CaptureOutcome> {
  try {
    const [{ renderStillOnWeb }, { Film }] = await Promise.all([
      import("@remotion/web-renderer"),
      import("@/remotion/Film"),
    ]);

    // A still has no sound. Leaving the audio layers out spares the
    // renderer decoding a music bed for a picture, and spares the capture
    // any audio the renderer cannot decode.
    const props = {
      file: { ...file, tracks: file.tracks.filter((track) => track.kind !== "audio") },
      assets,
    };
    const composition = {
      id: "Film",
      component: Film,
      durationInFrames: file.durationInFrames,
      fps: file.fps,
      width: file.width,
      height: file.height,
      defaultProps: props,
    };

    const pages = pageFrames(frames, options.layout === "single" ? 1 : FRAMES_PER_SHEET);
    const mimeType = options.format === "png" ? "image/png" : "image/jpeg";
    const sheets: CapturedSheet[] = [];
    let board = 0;

    for (let page = 0; page < pages.length; page += 1) {
      const pageFramesHere = pages[page]!;
      const layout = sheetLayout(pageFramesHere.length, options.cellWidth, file.width / file.height);
      const scale = layout.cellWidth / file.width;

      const sheet = document.createElement("canvas");
      sheet.width = layout.width;
      sheet.height = layout.height;
      const ctx = sheet.getContext("2d");
      if (!ctx) return { ok: false, message: "This browser has no 2D canvas." };

      ctx.fillStyle = "#101010";
      ctx.fillRect(0, 0, sheet.width, sheet.height);
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "middle";

      const firstBoard = board;
      for (let index = 0; index < pageFramesHere.length; index += 1) {
        const frame = pageFramesHere[index]!;
        const cell = layout.cells[index]!;

        const still = await renderStillOnWeb({
          composition,
          inputProps: props,
          frame,
          scale,
          logLevel: "error",
        });
        const drawn = await still.canvas();
        ctx.drawImage(drawn, cell.x, cell.y, layout.cellWidth, layout.cellHeight);
        still.internalState[Symbol.dispose]();

        // Caption: board number, time, frame — the same place on every cell.
        ctx.fillStyle = "#1c1c1c";
        ctx.fillRect(cell.x, cell.y + layout.cellHeight, layout.cellWidth, layout.labelHeight);
        ctx.fillStyle = "#e6e6e6";
        ctx.fillText(
          `${boardNumber(board)}   ${timecode(frame, file.fps)}   f${frame}`,
          cell.x + 8,
          cell.y + layout.cellHeight + layout.labelHeight / 2,
        );
        board += 1;
      }

      // Footer: which image this is, of how many, and of what.
      ctx.fillStyle = "#8a8a8a";
      ctx.fillText(
        `${options.layout === "single" ? "Frame" : "Sheet"} ${page + 1} of ${pages.length}   ·   ${options.title}`,
        layout.gutter,
        layout.height - layout.footerHeight / 2,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        sheet.toBlob(resolve, mimeType, 0.85),
      );
      if (!blob) return { ok: false, message: "Could not encode the sheet." };

      sheets.push({
        blob,
        mimeType,
        width: sheet.width,
        height: sheet.height,
        frames: pageFramesHere,
        firstBoard,
      });
    }

    return { ok: true, sheets };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not render the frames.",
    };
  }
}

/** A data URL for the store and the panel; the base64 half is what the tool returns. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
