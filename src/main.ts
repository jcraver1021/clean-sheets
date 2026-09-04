import "./style.css";
import { createDemoScore } from "./demo-score.ts";
import { deleteEventAt, insertNote } from "./edit/commands.ts";
import { commit, getScore, initHistory, redo, undo } from "./edit/history.ts";
import {
  getActiveDurationTicks,
  resolveAlter,
  setAccidentalOverride,
  setActiveDurationTicks,
} from "./edit/tools.ts";
import { fromDiatonic } from "./model/pitch.ts";
import { waitForFonts } from "./platform/fonts.ts";
import { attachGhostNote } from "./render/cursor.ts";
import { hitTest } from "./render/hit-test.ts";
import type { LayoutIndex } from "./render/layout-index.ts";
import { renderScore } from "./render/renderer.ts";
import { createControlPanel } from "./ui/control-panel.ts";

// VexFlow's SMuFL glyphs are <text> in the Bravura web font, loaded async
// without being awaited on import — drawing before it's ready misaligns
// stems/ledger lines until the next repaint.
const { ready, missing } = await waitForFonts(["Bravura"]);
if (!ready) {
  console.warn(`Fonts not ready before first render: ${missing.join(", ")}`);
}

const container = document.querySelector<HTMLDivElement>("#score")!;
const controlsMount = document.querySelector<HTMLDivElement>("#controls")!;

let layoutIndex: LayoutIndex = { staves: [] };
function rerender(): void {
  layoutIndex = renderScore(container, getScore());
}

initHistory(createDemoScore(), rerender);

createControlPanel(controlsMount, {
  onDurationChange: setActiveDurationTicks,
  onAccidentalChange: setAccidentalOverride,
  onUndo: undo,
  onRedo: redo,
});

// Returns null if the click missed both the SVG and any hit-testable note
// slot — callers bail out in that case.
function hitFromMouseEvent(
  event: MouseEvent,
): { partId: string; tick: number; diatonic: number } | null {
  const svg = container.querySelector("svg");
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = hitTest(x, y, layoutIndex, getActiveDurationTicks());
  if (!hit) return null;

  // One stave per part now that hymnal mode is gone, so which line the
  // click landed on IS the part it targets — no separate part selector.
  const partId = hit.box.partIds[0];
  if (!partId) return null;
  return { partId, tick: hit.tick, diatonic: hit.diatonic };
}

// Left click inserts, right click deletes — no separate mode toggle.
container.addEventListener("click", (event) => {
  const hit = hitFromMouseEvent(event);
  if (!hit) return;

  const { step, octave } = fromDiatonic(hit.diatonic);
  commit((score) => {
    const alter = resolveAlter(score, hit.tick, step);
    insertNote(score, hit.partId, hit.tick, getActiveDurationTicks(), [
      { step, octave, alter },
    ]);
  });
});

container.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const hit = hitFromMouseEvent(event);
  if (!hit) return;

  commit((score) => deleteEventAt(score, hit.partId, hit.tick));
});

attachGhostNote(container, () => layoutIndex, getActiveDurationTicks);
