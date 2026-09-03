"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { NumberField, Row } from "@/components/editor/inspector/fields";
import { PanelInspector } from "@/components/editor/inspector/PanelInspector";
import { patchStoryboardPanel } from "@/lib/studio/actions";
import { BoardLayerSchema } from "@/lib/studio/schema";
import { boardPoseAt } from "@/lib/studio/storyboard";
import { useStudioStore } from "@/lib/studio/store";
import type { BoardLayer, BoardPose, ProjectFile, StoryboardPanel, StoryboardVisual } from "@/types/prism";

const KINDS = ["browser", "phone", "rect", "ellipse", "text", "image", "cursor", "arrow"] as const;

export function BoardComposer({ panel, frame, seek, file }: { panel: StoryboardPanel; frame: number; seek: (frame: number) => void; file: ProjectFile }) {
  const assets = useStudioStore((state) => state.assets);
  const [selected, setSelected] = useState<string | null>(null);
  const [kind, setKind] = useState<BoardLayer["kind"]>("browser");
  const [error, setError] = useState("");
  const visual = panel.visual ?? { background: "light", layers: [] };
  const layer = visual.layers.find((item) => item.id === selected) ?? visual.layers.at(-1);
  const images = Object.keys(assets).filter((path) => /\.(png|jpe?g|webp|svg|avif|gif)$/i.test(path));

  function save(next: StoryboardVisual) {
    const result = patchStoryboardPanel(panel.id, { visual: next });
    setError(result.ok ? "" : result.message);
  }
  function patch(fields: Partial<BoardLayer>) {
    if (!layer) return;
    save({ ...visual, layers: visual.layers.map((item) => item.id === layer.id ? { ...item, ...fields } : item) });
  }
  function pose(fields: Partial<BoardPose>) {
    if (!layer) return;
    if (frame <= layer.from) { patch(fields); return; }
    if (frame >= (layer.until ?? panel.durationInFrames)) { setError("Seek inside this layer's visible frames to edit its pose."); return; }
    const existing = layer.keyframes.find((keyframe) => keyframe.at === frame);
    if (!existing && layer.keyframes.length >= 8) { setError("This layer already has eight keyframes. Select one to edit it."); return; }
    const keyframes = layer.keyframes.filter((keyframe) => keyframe.at !== frame);
    keyframes.push({ ...boardPoseAt(layer, frame), ...existing, ...fields, at: frame, easing: existing?.easing ?? "smooth" });
    patch({ keyframes: keyframes.sort((a, b) => a.at - b.at) });
  }
  function add() {
    if (kind === "image" && !images.length) { setError("Import a screenshot in Files first, then add it here."); return; }
    const made = BoardLayerSchema.parse({
      id: `layer-${crypto.randomUUID().slice(0, 8)}`, kind,
      label: kind === "browser" ? "Product UI to capture" : kind === "text" ? "On-screen words" : kind,
      text: kind === "text" ? "Your words" : undefined,
      src: kind === "image" ? images[0] : undefined,
      x: .5, y: .5,
      width: kind === "cursor" ? .035 : kind === "phone" ? .2 : .6,
      height: kind === "cursor" ? .08 : kind === "text" || kind === "arrow" ? .15 : .65,
    });
    save({ ...visual, layers: [...visual.layers, made] });
    setSelected(made.id);
    seek(0);
  }
  function reorder(direction: number) {
    if (!layer) return;
    const layers = [...visual.layers];
    const index = layers.findIndex((item) => item.id === layer.id);
    const target = index + direction;
    if (target < 0 || target >= layers.length) return;
    layers.splice(index, 1);
    layers.splice(target, 0, layer);
    save({ ...visual, layers });
  }
  const position = layer ? boardPoseAt(layer, Math.max(frame, layer.from)) : null;
  return (
    <aside aria-label="Edit shot layout" className="thin-scroll flex max-h-[max(220px,calc(100dvh-360px))] flex-col gap-4 overflow-y-auto pr-1">
      <div>
        <h3 className="text-sm font-medium text-ink">Shot layers</h3>
        <p className="mt-1 text-xs text-muted">Back to front. Positions and sizes use 0–1 canvas fractions. Seek to a later frame, then change a position to create movement.</p>
      </div>
      <Field label="Ground"><Select label="Board ground" value={visual.background} options={[{ value: "light", label: "Light rough" }, { value: "dark", label: "Dark rough" }]} onChange={(value) => save({ ...visual, background: value as "light" | "dark" })} /></Field>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1"><Select label="New layer kind" value={kind} options={KINDS.map((value) => ({ value, label: value }))} onChange={(value) => setKind(value as BoardLayer["kind"])} /></div>
        <Button onClick={add} disabled={visual.layers.length >= 32} icon={<Plus size={14} aria-hidden />}>Add</Button>
      </div>
      <ol className="max-h-40 overflow-auto rounded-sm border border-line-soft">
        {visual.layers.map((item, index) => <li key={item.id}><button type="button" onClick={() => { setSelected(item.id); seek(item.from); }} aria-pressed={layer?.id === item.id} className={`ds-focus flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${layer?.id === item.id ? "bg-accent-soft text-accent-ink" : "text-muted hover:bg-sunken"}`}><span className="font-mono">{index + 1}</span><span className="min-w-0 flex-1 truncate">{item.label}</span><span>{item.kind}</span></button></li>)}
      </ol>
      {layer && position ? <>
        <div className="flex gap-1"><Button size="sm" variant="quiet" disabled={visual.layers[0]?.id === layer.id} onClick={() => reorder(-1)}>Move layer back</Button><Button size="sm" variant="quiet" disabled={visual.layers.at(-1)?.id === layer.id} onClick={() => reorder(1)}>Move layer forward</Button></div>
        <Field label="Object label" htmlFor="board-object-label"><TextInput id="board-object-label" value={layer.label} maxLength={80} onChange={(event) => patch({ label: event.target.value })} /></Field>
        {!["cursor", "arrow", "image"].includes(layer.kind) ? <Field label="Text in the frame" htmlFor="board-object-text"><TextArea id="board-object-text" value={layer.text ?? ""} maxLength={240} rows={2} onChange={(event) => patch({ text: event.target.value })} /></Field> : null}
        {["image", "browser", "phone"].includes(layer.kind) ? <Field label="Screenshot"><Select label="Screenshot asset" value={layer.src ?? ""} options={[...(layer.kind === "image" ? [] : [{ value: "", label: "Labelled rough" }]), ...images.map((path) => ({ value: path, label: path.split("/").pop()! }))]} onChange={(value) => {
          if (!value) {
            const { src: _src, ...without } = layer; void _src;
            save({ ...visual, layers: visual.layers.map((item) => item.id === layer.id ? without : item) });
          } else patch({ src: value });
        }} /></Field> : null}
        <p className="font-mono text-xs text-muted">Pose at frame {frame}{frame <= layer.from ? " · starting position" : " · keyframe"}</p>
        <Row><NumberField label="X" value={Number(position.x.toFixed(3))} step={.01} min={-2} max={3} onChange={(x) => pose({ x })} /><NumberField label="Y" value={Number(position.y.toFixed(3))} step={.01} min={-2} max={3} onChange={(y) => pose({ y })} /></Row>
        <Row><NumberField label="Width" value={Number(position.width.toFixed(3))} step={.01} min={.01} max={3} onChange={(width) => pose({ width })} /><NumberField label="Height" value={Number(position.height.toFixed(3))} step={.01} min={.01} max={3} onChange={(height) => pose({ height })} /></Row>
        <Row><NumberField label="Rotation" value={Number(position.rotation.toFixed(1))} step={1} min={-180} max={180} onChange={(rotation) => pose({ rotation })} /><NumberField label="Opacity" value={Number(position.opacity.toFixed(2))} step={.1} min={0} max={1} onChange={(opacity) => pose({ opacity })} /></Row>
        <Field label="Tone"><Select label="Object tone" value={layer.tone} options={["paper", "ink", "muted", "outline"].map((value) => ({ value, label: value }))} onChange={(value) => patch({ tone: value as BoardLayer["tone"] })} /></Field>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="quiet" onClick={() => seek(layer.from)}>Start</Button>
          {layer.keyframes.map((keyframe) => <Button key={keyframe.at} size="sm" variant="quiet" onClick={() => seek(keyframe.at)}>f{keyframe.at}</Button>)}
          <Button size="sm" variant="quiet" onClick={() => seek((layer.until ?? panel.durationInFrames) - 1)}>End</Button>
        </div>
        {layer.keyframes.some((keyframe) => keyframe.at === frame) ? <Button size="sm" variant="quiet" onClick={() => patch({ keyframes: layer.keyframes.filter((keyframe) => keyframe.at !== frame) })}>Remove this keyframe</Button> : null}
        <Button variant="quiet" disabled={visual.layers.length <= 1} onClick={() => save({ ...visual, layers: visual.layers.filter((item) => item.id !== layer.id) })} icon={<Trash2 size={13} aria-hidden />}>Remove layer</Button>
      </> : null}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
      <details className="border-t border-line-soft pt-3"><summary className="ds-focus cursor-pointer text-xs font-medium text-ink">Shot notes and timing</summary><div className="mt-3"><PanelInspector panel={panel} file={file} index={file.process.storyboard.panels.findIndex((item) => item.id === panel.id)} /></div></details>
    </aside>
  );
}
