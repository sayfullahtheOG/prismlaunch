import type { ProjectFile } from "@/types/prism";
import { sheetLayout, timecode } from "./capture-plan";

/**
 * Render chosen frames of the composition and lay them on one contact sheet.
 *
 * The same `Film` component the player mounts and the exporter encodes is the
 * one rendered here, through `renderStillOnWeb`, so what the agent sees is
 * what the person sees and what the file will contain. Each frame is rendered
 * at the sheet's cell size rather than full size and scaled down, which is
 * the difference between a second and ten for a dozen frames.
 *
 * One image rather than a dozen: a model reads a labelled grid as a sequence
 * — this, then this, then this — and that is exactly the question an
 * animation check is asking. Each cell carries its time and frame number so
 * the agent can name the moment it wants changed.
 *
 * Dynamically imported, like the exporter, so none of this enters the bundle
 * until an agent asks to look.
 */

export type CaptureOptions = {
  /** Width of each cell in pixels. */
  cellWidth: number;
  format: "jpeg" | "png";
};

export type CaptureOutcome =
  | { ok: true; blob: Blob; mimeType: string; width: number; height: number }
  | { ok: false; message: string };

export async function captureSheet(
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

    const props = { file, assets };
    const composition = {
      id: "Film",
      component: Film,
      durationInFrames: file.durationInFrames,
      fps: file.fps,
      width: file.width,
      height: file.height,
      defaultProps: props,
    };

    const layout = sheetLayout(frames.length, options.cellWidth, file.width / file.height);
    const scale = layout.cellWidth / file.width;

    const sheet = document.createElement("canvas");
    sheet.width = layout.width;
    sheet.height = layout.height;
    const ctx = sheet.getContext("2d");
    if (!ctx) return { ok: false, message: "This browser has no 2D canvas." };

    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 0, sheet.width, sheet.height);

    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index]!;
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

      // Caption: time and frame, in the same place on every cell.
      ctx.fillStyle = "#1c1c1c";
      ctx.fillRect(cell.x, cell.y + layout.cellHeight, layout.cellWidth, layout.labelHeight);
      ctx.fillStyle = "#e6e6e6";
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `${timecode(frame, file.fps)}  ·  f${frame}`,
        cell.x + 8,
        cell.y + layout.cellHeight + layout.labelHeight / 2,
      );
    }

    const mimeType = options.format === "png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      sheet.toBlob(resolve, mimeType, 0.85),
    );
    if (!blob) return { ok: false, message: "Could not encode the sheet." };

    return { ok: true, blob, mimeType, width: sheet.width, height: sheet.height };
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
