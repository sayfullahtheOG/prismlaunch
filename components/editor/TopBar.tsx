"use client";

import { useState } from "react";
import {
  Check,
  Download,
  FilePlus2,
  Film,
  Pencil,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuNote,
  MenuSeparator,
} from "@/components/ui/Menu";

/**
 * The top bar: what the composition is called, what you can do to it, and
 * Export.
 *
 * It used to also print "0.0s · 2 layers", which the timeline already says
 * twice — once in its transport readout and once in the layer rows. A number
 * repeated in three places is three chances to disagree, and none of them were
 * the place anyone was looking.
 *
 * What is left is the project itself: name it, rename it, make another, delete
 * it. The name is both the label and the menu trigger, which is the shape every
 * editor uses because the name is what you are acting on.
 */

export type CompositionEntry = {
  slug: string;
  /** Null when the folder holds no readable project.json. */
  name: string | null;
  problem: string | null;
};

type Props = {
  /** The composition's name, or a standing-in phrase when none is open. */
  name: string;
  /** Absent when nothing is open — and then there is no project to act on. */
  project?:
    | {
        slug: string;
        /** Everything in the linked folder, so the menu can switch between them. */
        compositions: readonly CompositionEntry[];
        onOpenMenu: () => void;
        onOpen: (slug: string) => void;
        onRename: (name: string) => void;
        onCreate: () => void;
        onDelete: () => void;
      }
    | undefined;
  /** Render is blocked while any clip is still a draft. */
  renderBlockedReason: string | null;
  onRender: () => void;
  /** Last render outcome. Shown inline so failures are never silent. */
  note?: string | null;
  busy?: boolean;
};

export function TopBar({
  name,
  project,
  renderBlockedReason,
  onRender,
  note,
  busy = false,
}: Props) {
  const blocked = renderBlockedReason !== null;

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line-soft bg-surface px-4">
      <span className="flex items-center gap-2.5 text-md font-bold tracking-[var(--ds-tracking-tight)]">
        <Mark />
        PrismLaunch
      </span>

      <span className="h-6 w-px bg-line-soft" aria-hidden />

      {project ? (
        <ProjectMenu name={name} {...project} />
      ) : (
        <span className="px-2.5 text-sm text-muted">{name}</span>
      )}

      {note ? (
        <span
          className="max-w-[34ch] truncate text-xs text-muted"
          title={note}
          role="status"
        >
          {note}
        </span>
      ) : null}

      <div className="flex-1" />

      {/*
        Monochrome, not cobalt. Export is the primary action, and the system's
        default for a primary action is an ink fill — accent has to be earned
        by state, not spent on the biggest button on screen.

        Disabled with an honest reason rather than hidden.
      */}
      <Button
        variant="primary"
        onClick={onRender}
        disabled={blocked}
        loading={busy}
        title={renderBlockedReason ?? "Render an MP4 from the accepted clips"}
        icon={<Download size={15} strokeWidth={2} aria-hidden />}
      >
        Export
      </Button>
    </header>
  );
}

function ProjectMenu({
  name,
  slug,
  compositions,
  onOpenMenu,
  onOpen,
  onRename,
  onCreate,
  onDelete,
}: {
  name: string;
  slug: string;
  compositions: readonly CompositionEntry[];
  onOpenMenu: () => void;
  onOpen: (slug: string) => void;
  onRename: (name: string) => void;
  onCreate: () => void;
  onDelete: () => void;
}) {
  /**
   * Null when nobody is editing, which is also what "not editing" means.
   *
   * These were two pieces of state kept in step by an effect that copied the
   * name down, which React's lint flags — and which was wrong for a better
   * reason than cascading renders: the agent can rename the composition in the
   * file while this field is open, and a mirrored copy has to decide whether to
   * clobber what someone is typing. With one piece of state there is no
   * question. While you are editing, your text wins.
   */
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    const next = (draft ?? "").trim();
    setDraft(null);
    if (next && next !== name) onRename(next);
  }

  if (draft !== null) {
    return (
      <input
        value={draft}
        autoFocus
        maxLength={80}
        aria-label="Composition name"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setDraft(null);
        }}
        className="ds-focus ds-inset min-h-11 w-64 rounded-sm bg-sunken px-2.5 text-sm font-semibold text-ink"
      />
    );
  }

  return (
    <Menu label={name} width={268} onOpen={onOpenMenu}>
      <ProjectMenuItems
        name={name}
        slug={slug}
        compositions={compositions}
        onOpen={onOpen}
        onStartRename={() => setDraft(name)}
        onCreate={onCreate}
        onDelete={onDelete}
      />
    </Menu>
  );
}

/**
 * The menu's contents, including its own delete confirmation.
 *
 * Confirming in place rather than in a dialog: the menu is already a surface
 * over the thing being deleted, and a dialog on top of it would be a second
 * layer for a question with two answers. The confirmation names the folder and
 * says the word "permanently", because `removeEntry` is final — there is no
 * trash on the File System Access API, and the folder may hold renders that
 * took minutes to encode.
 */
function ProjectMenuItems({
  name,
  slug,
  compositions,
  onOpen,
  onStartRename,
  onCreate,
  onDelete,
}: {
  name: string;
  slug: string;
  compositions: readonly CompositionEntry[];
  onOpen: (slug: string) => void;
  onStartRename: () => void;
  onCreate: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <>
        <MenuNote>
          Permanently delete <strong className="text-ink">{name}</strong>, its
          folder, and any renders inside it. This cannot be undone.
        </MenuNote>
        <MenuItem
          tone="danger"
          icon={<Trash2 size={14} strokeWidth={1.9} aria-hidden />}
          ariaLabel={`Permanently delete ${name}, its folder and any renders inside it. This cannot be undone.`}
          onSelect={onDelete}
        >
          Delete permanently
        </MenuItem>
        <MenuItem keepOpen onSelect={() => setConfirming(false)}>
          Cancel
        </MenuItem>
      </>
    );
  }

  return (
    <>
      {/*
        Switching lives above the verbs because it is what the menu is most
        often opened for: the name is a place you are, and the first thing you
        want from it is somewhere else.
      */}
      <MenuGroup label="Compositions" scroll={compositions.length > 6}>
        {compositions.map((entry) => (
          <MenuItem
            key={entry.slug}
            checked={entry.slug === slug}
            disabled={entry.name === null}
            {...(entry.problem
              ? { ariaLabel: `${entry.slug}, unreadable: ${entry.problem}` }
              : {})}
            icon={
              entry.slug === slug ? (
                <Check size={14} strokeWidth={2.4} aria-hidden />
              ) : entry.name === null ? (
                <TriangleAlert size={14} strokeWidth={1.9} aria-hidden />
              ) : (
                <Film size={14} strokeWidth={1.9} aria-hidden />
              )
            }
            onSelect={() => onOpen(entry.slug)}
          >
            <span className="truncate">{entry.name ?? entry.slug}</span>
          </MenuItem>
        ))}
      </MenuGroup>

      <MenuSeparator />

      <MenuItem
        icon={<Pencil size={14} strokeWidth={1.9} aria-hidden />}
        onSelect={onStartRename}
      >
        Rename
      </MenuItem>
      <MenuItem
        icon={<FilePlus2 size={14} strokeWidth={1.9} aria-hidden />}
        onSelect={onCreate}
      >
        New composition
      </MenuItem>

      <MenuSeparator />

      <MenuItem
        tone="danger"
        icon={<Trash2 size={14} strokeWidth={1.9} aria-hidden />}
        keepOpen
        onSelect={() => setConfirming(true)}
      >
        Delete composition
      </MenuItem>
    </>
  );
}

/** Prism mark: a split beam. Monochrome, inherits ink. */
function Mark() {
  return (
    <span
      aria-hidden
      className="ds-raised grid size-7 place-items-center rounded-xs bg-ink"
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 2 13.5 12.5H2.5L8 2Z"
          stroke="var(--ds-color-inverse)"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="M8 2v10.5"
          stroke="var(--ds-color-inverse)"
          strokeWidth="1.3"
          opacity="0.5"
        />
      </svg>
    </span>
  );
}
