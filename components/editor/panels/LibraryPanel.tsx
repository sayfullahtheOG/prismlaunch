"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createElement } from "@/lib/studio/actions";
import { LIBRARY, LIBRARY_GROUPS, type LibraryItem } from "@/lib/studio/library";
import type { ProjectFile } from "@/types/prism";
import { PanelShell, PanelSection } from "./PanelShell";

/**
 * Prebuilt pieces, one click from being elements of this film.
 *
 * The library is not the film's: nothing here is placed or reviewed. Adding
 * an item copies it into Elements under its own id, and from then on it is
 * the film's to change. The same name can be added twice; the second gets a
 * number, the way a new layer does.
 */
export function LibraryPanel({ file }: { file: ProjectFile }) {
  return (
    <PanelShell title="Library">
      {LIBRARY_GROUPS.map((group) => (
        <PanelSection key={group} label={group}>
          <ul className="flex flex-col divide-y divide-line-soft">
            {LIBRARY.filter((item) => item.group === group).map((item) => (
              <Item key={item.id} item={item} file={file} />
            ))}
          </ul>
        </PanelSection>
      ))}
    </PanelShell>
  );
}

function Item({ item, file }: { item: LibraryItem; file: ProjectFile }) {
  return (
    <li className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <Preview item={item} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink">{item.name}</p>
        <p className="mt-0.5 text-xs leading-[var(--ds-leading-body)] text-muted">{item.blurb}</p>
      </div>
      <Button
        variant="quiet"
        size="sm"
        aria-label={`Add ${item.name} to elements`}
        onClick={() => createElement({ ...item.draft, name: nextName(file, item.draft.name) })}
        icon={<Plus size={12} strokeWidth={2.4} aria-hidden />}
      >
        Add
      </Button>
    </li>
  );
}

const FAMILY: Record<"display" | "body" | "mono", string> = {
  display: "var(--film-display), Georgia, serif",
  body: "var(--ds-font-sans)",
  mono: "var(--ds-font-mono)",
};

/** A thumbnail on the film's dark ground: the face for type, the form for a shape. */
function Preview({ item }: { item: LibraryItem }) {
  const { draft } = item;
  return (
    <span
      className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xs bg-[#0A0A0C] shadow-[inset_0_0_0_1px_var(--ds-color-line-soft)]"
      aria-hidden
    >
      {draft.kind === "text" ? (
        <span
          className="text-base leading-none"
          style={{ fontFamily: FAMILY[draft.fontFamily], fontWeight: draft.fontWeight, color: draft.color }}
        >
          Aa
        </span>
      ) : draft.kind === "shape" ? (
        <span
          className="block"
          style={{
            width: `${Math.max(12, Math.min(28, draft.box.width * 36))}px`,
            height: `${Math.max(4, Math.min(28, draft.box.height * 36))}px`,
            background: draft.fill,
            borderRadius: draft.shape === "ellipse" ? "999px" : `${draft.radius * 16}px`,
          }}
        />
      ) : null}
    </span>
  );
}

/** "Headline 2" when "Headline" is taken. */
function nextName(file: ProjectFile, stem: string): string {
  const taken = new Set(file.elements.map((element) => element.name));
  if (!taken.has(stem)) return stem;
  let n = 2;
  while (taken.has(`${stem} ${n}`)) n += 1;
  return `${stem} ${n}`;
}
