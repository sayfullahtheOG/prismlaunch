"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/**
 * The dropdown.
 *
 * A native `<select>` renders the operating system's own control — Apple's
 * grey chrome on macOS — which ignores every token in the system: wrong
 * radius, wrong type, wrong elevation, no theme awareness, and a popup that
 * cannot be styled at all. So this is a real listbox.
 *
 * It follows the ARIA button + listbox pattern rather than the combobox
 * pattern, because there is no text input here — the trigger only opens a list.
 * Full keyboard support: Enter/Space/Down/Up open, Up/Down move, Home/End jump,
 * Enter/Space select, Escape closes, Tab closes. Focus always returns to the
 * trigger, and the active option is tracked with `aria-activedescendant` so
 * focus never actually leaves it.
 */

export type SelectOption = {
  value: string;
  label: string;
  /** Optional second line — a path, a hint. Kept to one line. */
  detail?: string;
};

type Props = {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  /** Accessible name. Pair with a visible <Field label>. */
  label: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function Select({
  value,
  options,
  onChange,
  label,
  id,
  placeholder = "Select…",
  disabled = false,
}: Props) {
  const generated = useId();
  const listId = `${id ?? generated}-listbox`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );

  /**
   * The active index is mirrored into a ref because `commit` must read the
   * CURRENT value, not the one captured when the handler was created. Pressing
   * ArrowDown then Enter faster than React re-renders would otherwise select
   * the previously highlighted option — easy to miss by hand, and exactly what
   * a fast typist does.
   */
  const activeIndexRef = useRef(activeIndex);

  /** Same reasoning for `open`: the handler must see the live value. */
  const openRef = useRef(false);
  function setOpenState(next: boolean) {
    openRef.current = next;
    setOpen(next);
  }

  function moveActive(next: number) {
    const clamped = Math.min(Math.max(next, 0), options.length - 1);
    activeIndexRef.current = clamped;
    setActiveIndex(clamped);
  }

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => option.value === value);

  // Close on outside pointer or on scroll elsewhere: a popover that hangs
  // around after the page moves under it reads as a rendering bug.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenState(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the active option in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openList(startAt = activeIndexRef.current) {
    if (disabled) return;
    moveActive(startAt);
    setOpenState(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpenState(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;

    if (!openRef.current) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        setOpenState(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        // Let focus move on, but never leave an orphaned popover behind.
        setOpenState(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveActive(activeIndexRef.current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(activeIndexRef.current - 1);
        break;
      case "Home":
        event.preventDefault();
        moveActive(0);
        break;
      case "End":
        event.preventDefault();
        moveActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndexRef.current);
        break;
      default:
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        aria-activedescendant={
          open ? `${listId}-option-${activeIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => (openRef.current ? setOpenState(false) : openList())}
        className="ds-inset ds-focus flex min-h-11 w-full items-center gap-2 rounded-sm bg-sunken px-3 text-left text-sm text-ink transition-shadow duration-140 ease-[var(--ease-standard)] disabled:opacity-45"
      >
        <span className={`flex-1 truncate ${selected ? "" : "text-subtle"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.8}
          aria-hidden
          className={`shrink-0 text-subtle transition-transform duration-140 ease-[var(--ease-standard)] ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          className="ds-floating thin-scroll absolute z-[var(--ds-z-dropdown)] mt-1.5 max-h-64 w-full overflow-y-auto rounded-sm bg-raised p-1.5"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;

            return (
              <li
                key={option.value}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                data-index={index}
                onPointerEnter={() => moveActive(index)}
                onClick={() => commit(index)}
                className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xs px-2.5 py-1.5 transition-colors duration-140 ease-[var(--ease-standard)] ${
                  isActive ? "bg-sunken" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm ${isSelected ? "font-semibold text-ink" : "text-ink"}`}
                  >
                    {option.label}
                  </span>
                  {option.detail ? (
                    <span className="block truncate font-mono text-2xs text-subtle">
                      {option.detail}
                    </span>
                  ) : null}
                </span>

                {/* Selection is shown by a mark, not by colour alone. */}
                <Check
                  size={15}
                  strokeWidth={2.4}
                  aria-hidden
                  className={`shrink-0 text-accent ${isSelected ? "" : "invisible"}`}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
