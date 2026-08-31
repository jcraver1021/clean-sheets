import "./style.css";
import { renderSatbGrandStaffDemo } from "./satb-grand-staff-demo.ts";

// VexFlow's SMuFL glyphs are SVG <text> in the Bravura web font, loaded async
// on import without being awaited — drawing before it's ready misaligns
// stems/ledger lines against fallback-font glyph metrics until the next repaint.
await document.fonts.ready;

const container = document.querySelector<HTMLDivElement>("#score")!;
renderSatbGrandStaffDemo(container);
