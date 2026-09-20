import { jsPDF } from "jspdf";
import "svg2pdf.js"; // Side-effect import: augments jsPDF with doc.svg().
import type { Score } from "../model/score.ts";
import {
  PAGE_HEIGHT_PT,
  PAGE_WIDTH_PT,
  renderPrintPages,
} from "../render/print-pages.ts";
import { triggerDownload } from "./download.ts";

const BRAVURA_URL = "/fonts/bravura.ttf";
const BRAVURA_FILENAME = "Bravura.ttf";

// VexFlow renders glyphs as real SMuFL <text> in the Bravura web font, not
// path outlines (confirmed by Stage 8's glyph check) — svg2pdf.js needs a
// same-named font already registered in the PDF or notation comes out as
// boxes. jsPDF's bundled font parser only understands TrueType outlines,
// but Bravura ships as CFF-flavored OpenType, so this is a converted copy
// (via fontTools' otf2ttf) rather than the stock font — see public/fonts.
let bravuraBase64: Promise<string> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000; // Below the argument-count limit for spreading into String.fromCharCode.
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Fetched once, lazily — most sessions never export a PDF, so there's no
// reason to pay for the ~1MB font fetch/decode until someone actually
// clicks Download PDF.
function loadBravuraBase64(): Promise<string> {
  bravuraBase64 ??= fetch(BRAVURA_URL)
    .then((response) => response.arrayBuffer())
    .then(arrayBufferToBase64);
  return bravuraBase64;
}

// Two svg2pdf.js quirks VexFlow's SVG output runs straight into:
//
// 1. VexFlow sets font-family once, on the root <svg>, relying on normal
//    SVG attribute inheritance for every <text> under it — but svg2pdf.js
//    only reads presentation attributes set directly on the element being
//    drawn, not inherited ones.
// 2. VexFlow writes font-size as e.g. "30pt". svg2pdf.js's unit parser
//    (`toPixels`) only recognizes "em", "px", or a bare number — anything
//    else, including "pt", silently becomes 0. Since our page's coordinate
//    space is already 1 unit = 1pt (jsPDF's `unit: "pt"`, matched 1:1 in
//    the `doc.svg()` width/height below), stripping the suffix and keeping
//    the same number preserves the exact intended size.
//
// Both failures are silent — text draws at size 0 with the wrong font, so
// notation vanishes while plain vector ink (staff lines, stems) is
// unaffected.
function fixTextAttributesForSvg2pdf(svg: SVGSVGElement): void {
  const fontFamily = svg.getAttribute("font-family");
  svg.querySelectorAll("text").forEach((text) => {
    if (fontFamily) text.setAttribute("font-family", fontFamily);
    const fontSize = text.getAttribute("font-size");
    if (fontSize?.endsWith("pt")) {
      text.setAttribute("font-size", fontSize.slice(0, -2));
    }
  });
}

/**
 * Builds a PDF from `score`'s paginated pages (render/print-pages.ts) and
 * downloads it. `container` is rendered into directly — main.ts passes the
 * same hidden #print-pages element the Print button uses.
 */
export async function downloadPdf(
  container: HTMLElement,
  score: Score,
): Promise<void> {
  renderPrintPages(container, score);
  const pages = [...container.querySelectorAll<SVGSVGElement>(".page svg")];
  pages.forEach(fixTextAttributesForSvg2pdf);

  const bravura = await loadBravuraBase64();
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.addFileToVFS(BRAVURA_FILENAME, bravura);
  doc.addFont(BRAVURA_FILENAME, "Bravura", "normal");
  doc.setFont("Bravura");

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) doc.addPage();
    await doc.svg(pages[i]!, {
      x: 0,
      y: 0,
      width: PAGE_WIDTH_PT,
      height: PAGE_HEIGHT_PT,
    });
  }

  triggerDownload(doc.output("blob"), `${score.title || "score"}.pdf`);
}
