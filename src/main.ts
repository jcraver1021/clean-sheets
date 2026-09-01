import "./style.css";
import { LAYOUTS_BY_KIND, createDemoScore } from "./demo-score.ts";
import { waitForFonts } from "./platform/fonts.ts";
import { attachGhostNote } from "./render/cursor.ts";
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

const score = createDemoScore();
const container = document.querySelector<HTMLDivElement>("#score")!;
const controlsMount = document.querySelector<HTMLDivElement>("#controls")!;
const { layoutToggle } = createControlPanel(controlsMount);

let layoutIndex: LayoutIndex = { staves: [] };
function rerender() {
  layoutIndex = renderScore(container, score);
}

layoutToggle.addEventListener("click", () => {
  score.layout =
    score.layout.kind === "grandStaff"
      ? LAYOUTS_BY_KIND.openScore
      : LAYOUTS_BY_KIND.grandStaff;
  rerender();
});

rerender();

// Stage 2 predates the duration palette, so the grid is hardcoded to a
// quarter note until edit/tools.ts exists (Stage 3).
attachGhostNote(container, () => layoutIndex, score.divisions);
