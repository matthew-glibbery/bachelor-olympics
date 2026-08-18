"use client";

/**
 * A roving menu cursor.
 *
 * Owns "which item is the cursor on", moves it in response to the D-pad, and
 * hands back props to spread onto each item. Mouse and touch stay fully
 * supported — hovering moves the cursor and clicking confirms, so the same
 * markup works for someone on a phone in a garden and someone with a
 * controller plugged in.
 *
 * Accessibility: items get roving tabindex and real focus, so Tab, screen
 * readers, and the D-pad all agree on where the cursor is.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playSfx } from "@/lib/sfx";
import { useGameInput, type Direction } from "./use-game-input";

export type MenuNavOptions = {
  count: number;
  /** Number of columns for grid navigation. 1 = a vertical list. */
  columns?: number;
  /** Wrap around at the ends. Default true — console menus almost always do. */
  wrap?: boolean;
  initialIndex?: number;
  onConfirm?: (index: number) => void;
  onBack?: () => void;
  /** Indices the cursor refuses to land on (locked events, absent players). */
  disabledIndices?: readonly number[];
  enabled?: boolean;
  /** Whether moving the mouse over an item also moves the cursor there, the
   * way a real hover state would. Default true, matching the console-menu
   * feel most screens want. Set false for a strip where hovering while
   * scanning shouldn't change the selection out from under you (e.g. a
   * content-heavy admin list) — there, only a click or the D-pad moves it. */
  selectOnHover?: boolean;
};

export type MenuItemProps = {
  ref: (el: HTMLElement | null) => void;
  "data-n64-item": string;
  "data-active": string | undefined;
  tabIndex: number;
  onPointerEnter: () => void;
  onClick: () => void;
  onFocus: () => void;
};

export function useMenuNav({
  count,
  columns = 1,
  wrap = true,
  initialIndex = 0,
  onConfirm,
  onBack,
  disabledIndices,
  enabled = true,
  selectOnHover = true,
}: MenuNavOptions) {
  const [index, setIndexRaw] = useState(initialIndex);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  /** Suppresses the move blip for programmatic jumps (mount, clamping). */
  const silentRef = useRef(true);

  const disabled = useMemo(
    () => new Set(disabledIndices ?? []),
    [disabledIndices]
  );

  const isDisabled = useCallback((i: number) => disabled.has(i), [disabled]);

  const setIndex = useCallback(
    (next: number, opts?: { silent?: boolean }) => {
      setIndexRaw((prev) => {
        if (next === prev) return prev;
        if (!opts?.silent) playSfx("move");
        return next;
      });
    },
    []
  );

  // If the item count shrinks under the cursor (an event gets cancelled), pull
  // it back into range rather than leaving it pointing at nothing.
  useEffect(() => {
    if (count === 0) return;
    if (index > count - 1) {
      silentRef.current = true;
      setIndexRaw(count - 1);
    }
  }, [count, index]);

  /**
   * Steps `from` by `step`, skipping disabled items. Bounded by `count` so a
   * fully-disabled list can't spin forever.
   */
  const step = useCallback(
    (from: number, delta: number): number => {
      if (count === 0) return from;
      let next = from;
      for (let attempts = 0; attempts < count; attempts++) {
        next += delta;
        if (next < 0 || next > count - 1) {
          if (!wrap) return from;
          next = ((next % count) + count) % count;
        }
        if (!isDisabled(next)) return next;
      }
      return from;
    },
    [count, wrap, isDisabled]
  );

  const move = useCallback(
    (dir: Direction) => {
      if (count === 0) return;
      const rows = Math.ceil(count / columns);

      let next = index;
      if (columns <= 1) {
        // A plain list: left/right and up/down do the same thing, which is what
        // people reach for without thinking.
        next = step(index, dir === "up" || dir === "left" ? -1 : 1);
      } else if (dir === "left" || dir === "right") {
        next = step(index, dir === "left" ? -1 : 1);
      } else {
        // Vertical movement in a grid jumps a whole row, then falls back to
        // stepping if that lands out of range or on a disabled item.
        const delta = dir === "up" ? -columns : columns;
        const candidate = index + delta;
        if (candidate >= 0 && candidate < count && !isDisabled(candidate)) {
          next = candidate;
        } else if (wrap && rows > 1) {
          const wrapped = ((candidate % count) + count) % count;
          next = isDisabled(wrapped) ? step(wrapped, 1) : wrapped;
        }
      }

      setIndex(next);
    },
    [count, columns, index, step, wrap, isDisabled, setIndex]
  );

  const confirm = useCallback(() => {
    if (count === 0) return;
    if (isDisabled(index)) {
      playSfx("deny");
      return;
    }
    playSfx("confirm");
    onConfirm?.(index);
  }, [count, index, isDisabled, onConfirm]);

  const back = useCallback(() => {
    if (!onBack) return;
    playSfx("back");
    onBack();
  }, [onBack]);

  useGameInput({
    enabled,
    onDirection: move,
    onConfirm: confirm,
    onBack: back,
  });

  // Keep DOM focus on the cursor so assistive tech and the visual cursor agree.
  useEffect(() => {
    if (!enabled) return;
    const el = itemRefs.current[index];
    if (!el) return;
    // Don't steal focus from a slider or text field the user is actually using.
    const active = document.activeElement;
    const isItem = active?.hasAttribute("data-n64-item");
    if (active && active !== document.body && !isItem) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [index, enabled]);

  const getItemProps = useCallback(
    (i: number): MenuItemProps => ({
      ref: (el: HTMLElement | null) => {
        itemRefs.current[i] = el;
      },
      "data-n64-item": "",
      "data-active": i === index ? "" : undefined,
      tabIndex: i === index ? 0 : -1,
      onPointerEnter: () => {
        if (selectOnHover && !isDisabled(i)) setIndex(i);
      },
      onClick: () => {
        if (isDisabled(i)) {
          playSfx("deny");
          return;
        }
        setIndex(i, { silent: true });
        playSfx("confirm");
        onConfirm?.(i);
      },
      onFocus: () => setIndex(i, { silent: true }),
    }),
    [index, isDisabled, setIndex, onConfirm, selectOnHover]
  );

  return { index, setIndex, getItemProps, isDisabled };
}
