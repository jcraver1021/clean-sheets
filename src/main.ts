import "./style.css";
import { LAYOUTS_BY_KIND, createDemoScore } from "./demo-score.ts";
import { waitForFonts } from "./platform/fonts.ts";
import { renderScore } from "./render/renderer.ts";

// VexFlow's SMuFL glyphs are <text> in the Bravura web font, loaded async
// without being awaited on import — drawing before it's ready misaligns
// stems/ledger lines until the next repaint.
const { ready, missing } = await waitForFonts(["Bravura"]);
if (!ready) {
  console.warn(`Fonts not ready before first render: ${missing.join(", ")}`);
}

const score = createDemoScore();
const container = document.querySelector<HTMLDivElement>("#score")!;
const layoutToggle =
  document.querySelector<HTMLButtonElement>("#layout-toggle")!;

layoutToggle.addEventListener("click", () => {
  score.layout =
    score.layout.kind === "grandStaff"
      ? LAYOUTS_BY_KIND.openScore
      : LAYOUTS_BY_KIND.grandStaff;
  renderScore(container, score);
});

renderScore(container, score);
