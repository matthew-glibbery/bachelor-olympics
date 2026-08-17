"use client";

/**
 * The console input layer: D-pad, A, B, START — from a keyboard or an actual
 * gamepad.
 *
 * This is the half of the brief that isn't visual. A 1998 console menu isn't
 * driven by a mouse pointer landing on arbitrary pixels; it's a cursor that
 * steps between a fixed set of items, and that difference is most of why those
 * screens feel like they do. Mouse and touch still work everywhere (see
 * `useMenuNav`), because shipping a party app that only works with a keyboard
 * would be silly — but the keyboard/gamepad path is the primary one.
 */

import { useEffect, useRef } from "react";

export type Direction = "up" | "down" | "left" | "right";

export type GameInputHandlers = {
  onDirection?: (dir: Direction) => void;
  /** The A button. */
  onConfirm?: () => void;
  /** The B button. */
  onBack?: () => void;
  onStart?: () => void;
  /** Set false to detach without unmounting (e.g. while a modal is open). */
  enabled?: boolean;
};

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
};

// Z/X because that's what an emulator binds A/B to, and anyone who has played
// an N64 game in a browser will try it without being told.
const CONFIRM_KEYS = new Set(["Enter", " ", "z"]);
const BACK_KEYS = new Set(["Escape", "Backspace", "x"]);

/** Held-direction repeat, matching the feel of a real menu cursor. */
const REPEAT_DELAY_MS = 380;
const REPEAT_INTERVAL_MS = 110;
/** Analogue sticks rest slightly off-centre; ignore anything under this. */
const STICK_DEADZONE = 0.55;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function useGameInput(handlers: GameInputHandlers): void {
  const { enabled = true } = handlers;

  // Handlers land in a ref so re-renders don't rebind listeners or restart the
  // gamepad loop — the loop should survive a parent re-rendering every frame.
  const ref = useRef(handlers);
  ref.current = handlers;

  // ── Keyboard ──
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const h = ref.current;

      const dir = KEY_DIRECTIONS[key];
      if (dir) {
        // Arrow keys scroll the page by default, which fights the cursor.
        e.preventDefault();
        h.onDirection?.(dir);
        return;
      }
      if (CONFIRM_KEYS.has(key)) {
        e.preventDefault();
        // Enter doubles as START on the title screen; whichever handler is
        // bound wins, and onStart takes precedence when both are.
        if (h.onStart) h.onStart();
        else h.onConfirm?.();
        return;
      }
      if (BACK_KEYS.has(key)) {
        e.preventDefault();
        h.onBack?.();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);

  // ── Held-key repeat ──
  useEffect(() => {
    if (!enabled) return;

    let heldDir: Direction | null = null;
    let delayTimer: number | undefined;
    let repeatTimer: number | undefined;

    function stop() {
      window.clearTimeout(delayTimer);
      window.clearInterval(repeatTimer);
      heldDir = null;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const dir = KEY_DIRECTIONS[key];
      // `e.repeat` is the OS's own key repeat — ignore it and run our own, so
      // the cadence matches the gamepad path instead of the user's OS settings.
      if (!dir || e.repeat || dir === heldDir) return;

      stop();
      heldDir = dir;
      delayTimer = window.setTimeout(() => {
        repeatTimer = window.setInterval(() => {
          if (heldDir) ref.current.onDirection?.(heldDir);
        }, REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    }

    function onKeyUp(e: KeyboardEvent) {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (KEY_DIRECTIONS[key] === heldDir) stop();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", stop);
    return () => {
      stop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", stop);
    };
  }, [enabled]);

  // ── Gamepad ──
  // Genuinely worth having: plug in any USB/Bluetooth controller and the whole
  // app drives from it. Polling is the only option — the Gamepad API has no
  // button events.
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;

    let frame = 0;
    // Previous frame's pressed state, so we fire on the press edge only.
    let prev = { up: false, down: false, left: false, right: false, a: false, b: false, start: false };
    let nextRepeatAt = 0;

    function poll(now: number) {
      frame = requestAnimationFrame(poll);

      const pad = Array.from(navigator.getGamepads?.() ?? []).find(
        (p): p is Gamepad => p !== null && p.connected
      );
      if (!pad) return;

      const button = (i: number) => pad.buttons[i]?.pressed ?? false;
      const axis = (i: number) => pad.axes[i] ?? 0;

      // Standard mapping: 12–15 are the D-pad, 0/1 are A/B, 9 is START.
      const cur = {
        up: button(12) || axis(1) < -STICK_DEADZONE,
        down: button(13) || axis(1) > STICK_DEADZONE,
        left: button(14) || axis(0) < -STICK_DEADZONE,
        right: button(15) || axis(0) > STICK_DEADZONE,
        a: button(0),
        b: button(1),
        start: button(9),
      };

      const h = ref.current;
      const directions: Direction[] = ["up", "down", "left", "right"];

      for (const dir of directions) {
        if (cur[dir] && !prev[dir]) {
          h.onDirection?.(dir);
          nextRepeatAt = now + REPEAT_DELAY_MS;
        } else if (cur[dir] && now >= nextRepeatAt) {
          h.onDirection?.(dir);
          nextRepeatAt = now + REPEAT_INTERVAL_MS;
        }
      }

      if (cur.a && !prev.a) {
        if (h.onStart && !h.onConfirm) h.onStart();
        else h.onConfirm?.();
      }
      if (cur.b && !prev.b) h.onBack?.();
      if (cur.start && !prev.start) (h.onStart ?? h.onConfirm)?.();

      prev = cur;
    }

    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);
}
