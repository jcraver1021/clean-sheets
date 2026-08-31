import "./style.css";
import { renderSatbGrandStaffDemo } from "./satb-grand-staff-demo.ts";
import { waitForFonts } from "./platform/fonts.ts";

// VexFlow's SMuFL glyphs are SVG <text> in the Bravura web font, loaded async
// on import without being awaited — drawing before it's ready misaligns
// stems/ledger lines against fallback-font glyph metrics until the next repaint.
const { ready, missing } = await waitForFonts(["Bravura"]);
if (!ready) {
  console.warn(`Fonts not ready before first render: ${missing.join(", ")}`);
}

const container = document.querySelector<HTMLDivElement>("#score")!;
renderSatbGrandStaffDemo(container);
