"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

/**
 * A dropdown menu.
 *
 * The `menu` pattern, not the `listbox` one in Select.tsx. The difference is
 * not pedantry: a listbox picks a value and keeps a selection, a menu runs a
 * command and keeps nothing. Announcing "Delete composition" as a selectable
 * option that stays chosen would be wrong in a way a screen-reader user would
 * actually trip over.
 *
 * Focus moves into the menu on open and returns to the trigger on close, which
 * is what makes it usable from the keyboard at all — without the return, Escape
 * drops you at the top of the document.
 */

/**
 * Dismissal, reached through context rather than a render prop.
 *
 * An item closes the menu when it runs, which is what selecting a menu item
 * means — so the closing belongs to `MenuItem`, and only the rare item that
 * swaps the menu's contents (a delete confirmation) opts out. Handing `close`
 * down through `children(close)` instead would call a ref-touching function
 * during render, which React's lint refuses and is right to.
 */
const MenuContext = createContext<{ close: (focusTrigger?: boolean) => void } | null>(
  null,
);

/** Both item roles, so a list of compositions takes part in arrow-key focus. */
const ITEM_SELECTOR =
  '[role="menuitem"]:not([disabled]),[role="menuitemradio"]:not([disabled])';

export function Menu({
  label,
  children,
  align = "start",
  width = 220,
  onOpen,
}: {
  /** The trigger's text. */
  label: string;
  children: ReactNode;
  align?: "start" | "end";
  width?: number;
  /**
   * Fired as the menu opens. For a menu whose contents describe something
   * outside the app — a folder on disk, say — this is the moment to re-read
   * it, so what is listed is what is actually there.
   */
  onOpen?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const id = useId();

  /**
   * Whether closing should hand focus back.
   *
   * A flag plus an effect rather than focusing inside `close`, because `close`
   * is handed to `children` during render and a function that touches a ref
   * cannot safely be called there. Which is not a lint technicality: dismissing
   * by clicking elsewhere must NOT pull focus back to the trigger, or the thing
   * you clicked never gets it.
   */
  const returnFocus = useRef(false);

  function close(focusTrigger = true) {
    returnFocus.current = focusTrigger;
    setOpen(false);
  }

  const context = useMemo(() => ({ close }), []);

  useEffect(() => {
    if (open || !returnFocus.current) return;
    returnFocus.current = false;
    trigger.current?.focus();
  }, [open]);

  // Dismiss on an outside pointerdown or Escape. Pointerdown rather than click
  // so the menu is gone before whatever was clicked reacts — a click listener
  // lets the menu sit over the thing it is about to lose focus to.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !surface.current?.contains(target) &&
        !trigger.current?.contains(target)
      ) {
        close(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Focus the first item once the surface exists.
  useEffect(() => {
    if (!open) return;
    const first = surface.current?.querySelector<HTMLElement>(
      ITEM_SELECTOR,
    );
    first?.focus();
  }, [open]);

  /** Roving focus, read from the DOM so a conditional item cannot desync an index. */
  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();

    const items = [
      ...(surface.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []),
    ];
    if (items.length === 0) return;

    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "ArrowDown"
        ? (index + 1) % items.length
        : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen((was) => !was);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            onOpen?.();
            setOpen(true);
          }
        }}
        className={`ds-focus flex min-h-11 max-w-[22rem] items-center gap-1.5 rounded-sm px-2.5 text-sm transition-colors duration-140 ${
          open ? "bg-sunken text-ink" : "text-ink hover:bg-sunken"
        }`}
      >
        <span className="truncate font-semibold">{label}</span>
        <ChevronDown
          size={15}
          strokeWidth={1.9}
          aria-hidden
          className="shrink-0 text-subtle"
        />
      </button>

      {open ? (
        <div
          ref={surface}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          style={{ width }}
          className={`ds-floating absolute top-full z-50 mt-1 flex flex-col gap-0.5 rounded-sm bg-raised p-1.5 ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          <MenuContext.Provider value={context}>{children}</MenuContext.Provider>
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  onSelect,
  tone = "normal",
  disabled,
  keepOpen = false,
  ariaLabel,
  checked,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onSelect: () => void;
  /** `danger` for anything that destroys work. */
  tone?: "normal" | "danger";
  disabled?: boolean;
  /** For an item that replaces the menu's contents rather than acting. */
  keepOpen?: boolean;
  /**
   * Overrides the accessible name.
   *
   * Text sitting inside `role="menu"` that is not a `menuitem` can be skipped
   * entirely by a screen reader, so an item whose consequence is explained by
   * neighbouring prose has to carry that consequence itself. Only worth
   * reaching for when the visible label alone would be a lie by omission —
   * "Delete permanently" without "and its renders", say.
   */
  ariaLabel?: string;
  /**
   * Present when this item is one of a set and one of them is current — which
   * makes it a radio, not a command. `undefined` keeps it a plain menuitem;
   * `false` still announces it as an unselected option.
   */
  checked?: boolean;
}) {
  const menu = useContext(MenuContext);

  return (
    <button
      type="button"
      role={checked === undefined ? "menuitem" : "menuitemradio"}
      {...(checked === undefined ? {} : { "aria-checked": checked })}
      disabled={disabled}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      onClick={() => {
        onSelect();
        if (!keepOpen) menu?.close();
      }}
      className={`ds-focus flex min-h-9 items-center gap-2.5 rounded-xs px-2.5 text-left text-xs font-medium transition-colors duration-140 disabled:pointer-events-none disabled:opacity-45 ${
        tone === "danger"
          ? "text-danger hover:bg-warning-soft"
          : "text-ink hover:bg-sunken"
      }`}
    >
      {icon ? <span className="shrink-0 text-subtle">{icon}</span> : null}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <span role="separator" className="my-1 h-px bg-line-soft" />;
}

/**
 * A titled group of items.
 *
 * `role="group"` with a label rather than a bare heading, so the grouping is
 * announced rather than being a visual convention a screen reader cannot see.
 */
export function MenuGroup({
  label,
  children,
  scroll = false,
}: {
  label: string;
  children: ReactNode;
  /** For a group whose length is not bounded by the design — a folder listing. */
  scroll?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col">
      <span className="px-2.5 pt-1.5 pb-1 text-2xs font-semibold tracking-[var(--ds-tracking-label)] text-subtle uppercase">
        {label}
      </span>
      <div
        className={
          scroll
            ? "thin-scroll flex max-h-56 flex-col gap-0.5 overflow-y-auto"
            : "flex flex-col gap-0.5"
        }
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A line of explanation inside a menu.
 *
 * Visible to everyone, but not reliably announced — see `ariaLabel` on
 * `MenuItem`, which is how the item it explains carries the same words.
 */
export function MenuNote({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 py-1.5 text-2xs leading-[var(--ds-leading-body)] text-muted">
      {children}
    </p>
  );
}
