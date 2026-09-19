import type { Score } from "../model/score.ts";
import { triggerDownload } from "./download.ts";

const LOCAL_STORAGE_KEY = "clean-sheets:score";

/**
 * Converts a score to JSON text — the same format saved to `localStorage`
 * and downloaded as a file, so both paths agree.
 */
export function scoreToJson(score: Score): string {
  return JSON.stringify(score);
}

/**
 * Converts JSON text back into a `Score`. Throws on anything but
 * `schemaVersion: 1` — the only version that has ever existed — so a
 * future format change has one place to add a migration rather than
 * silently misreading an old file.
 */
export function jsonToScore(json: string): Score {
  const parsed: unknown = JSON.parse(json);
  const schemaVersion = (parsed as Partial<Score> | null)?.schemaVersion;
  if (schemaVersion !== 1) {
    throw new Error(`Unsupported schemaVersion: ${String(schemaVersion)}`);
  }
  return parsed as Score;
}

/**
 * Writes `score` to `storage` so work survives a reload. `storage`
 * defaults to the real `localStorage`; tests inject a fake (see
 * `waitForFonts` in platform/fonts.ts for the same pattern).
 */
export function saveToLocalStorage(
  score: Score,
  storage: Storage = localStorage,
): void {
  storage.setItem(LOCAL_STORAGE_KEY, scoreToJson(score));
}

/**
 * Reads back whatever `saveToLocalStorage` last wrote, or `null` if
 * there's nothing there yet or it's unreadable (a corrupt or
 * pre-`schemaVersion` entry shouldn't crash startup).
 */
export function loadFromLocalStorage(
  storage: Storage = localStorage,
): Score | null {
  const json = storage.getItem(LOCAL_STORAGE_KEY);
  if (!json) return null;
  try {
    return jsonToScore(json);
  } catch (error) {
    console.warn("Ignoring unreadable saved score:", error);
    return null;
  }
}

/**
 * Downloads `score` as a `.json` file.
 */
export function downloadScore(score: Score): void {
  triggerDownload(
    new Blob([scoreToJson(score)], { type: "application/json" }),
    `${score.title || "score"}.json`,
  );
}

/**
 * Opens the browser's file picker for a `.json` score and calls `onLoad`
 * with the parsed result. Silently does nothing if the user cancels —
 * there's no reliable cross-browser cancel event on a file input, so
 * there's nothing to clean up either way. `onError` gets whatever
 * `jsonToScore` throws for a malformed file.
 */
export function pickScoreFile(
  onLoad: (score: Score) => void,
  onError: (error: unknown) => void = console.error,
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => onLoad(jsonToScore(text)))
      .catch(onError);
  });
  input.click();
}
