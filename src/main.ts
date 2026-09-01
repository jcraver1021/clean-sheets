import "./style.css";
import { createDemoScore } from "./demo-score.ts";
import { deleteEventAt, insertNote } from "./edit/commands.ts";
import { commit, getScore, initHistory, redo, undo } from "./edit/history.ts";
import {
  getActiveDurationTicks,
  getActivePartId,
  getMode,
  resolveAlter,
  setAccidentalOverride,
  setActiveDurationTicks,
  setActivePartId,
  setMode,
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

const initialScore = createDemoScore();
setActivePartId(initialScore.parts[0]!.id);
initHistory(initialScore, rerender);

createControlPanel(controlsMount, getScore().parts, {
  onPartChange: setActivePartId,
  onDurationChange: setActiveDurationTicks,
  onAccidentalChange: setAccidentalOverride,
  onModeChange: setMode,
  onUndo: undo,
  onRedo: redo,
});

container.addEventListener("click", (event) => {
  const svg = container.querySelector("svg");
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = hitTest(x, y, layoutIndex, getActiveDurationTicks());
  if (!hit) return;

  const partId = getActivePartId();
  if (getMode() === "delete") {
    commit((score) => deleteEventAt(score, partId, hit.tick));
    return;
  }

  const { step, octave } = fromDiatonic(hit.diatonic);
  commit((score) => {
    const alter = resolveAlter(score, hit.tick, step);
    insertNote(score, partId, hit.tick, getActiveDurationTicks(), [
      { step, octave, alter },
    ]);
  });
});

attachGhostNote(container, () => layoutIndex, getActiveDurationTicks);
