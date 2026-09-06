import type { Score } from "../model/score.ts";

const UNDO_LIMIT = 100;

let current: Score | undefined;
let rerender: () => void = () => {};
const past: Score[] = [];
const future: Score[] = [];
let revision = 0;

function requireCurrent(): Score {
  if (!current)
    throw new Error("initHistory must be called before using edit/history.ts");
  return current;
}

/**
 * Call once from main.ts, and again whenever io/json.ts loads a different
 * score. `onChange` is how edit/ refreshes the view without importing
 * render/ — main.ts injects the callback, so edit/ depends on a function
 * type, not on the renderer.
 */
export function initHistory(score: Score, onChange: () => void): void {
  current = score;
  rerender = onChange;
  past.length = 0;
  future.length = 0;
  revision++; // Invalidates any revision-keyed cache (e.g. audio/flatten.ts).
  rerender();
}

export const getRevision = (): number => revision;
export const getScore = (): Score => requireCurrent();

export function commit(mutate: (score: Score) => void): void {
  const score = requireCurrent();
  past.push(structuredClone(score));
  if (past.length > UNDO_LIMIT) past.shift();
  future.length = 0; // A new edit discards the redo branch.
  mutate(score);
  revision++;
  rerender();
}

export function undo(): void {
  const prev = past.pop();
  if (!prev) return;
  future.push(structuredClone(requireCurrent()));
  current = prev;
  revision++;
  rerender();
}

export function redo(): void {
  const next = future.pop();
  if (!next) return;
  past.push(structuredClone(requireCurrent()));
  current = next;
  revision++;
  rerender();
}
