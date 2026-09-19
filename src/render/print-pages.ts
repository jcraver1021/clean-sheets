import { Renderer } from "vexflow";
import type { Score } from "../model/score.ts";
import { paginate } from "./paginate.ts";
import { buildRowSetups, drawMeasureColumn } from "./renderer.ts";
import type { RowSetup } from "./renderer.ts";

// US Letter, in points — matches the 612x792 jsPDF would use (SPEC.md §8),
// so a future PDF path stays pixel-identical to this print path.
export const PAGE_WIDTH_PT = 612;
export const PAGE_HEIGHT_PT = 792;
const PAGE_MARGIN_PT = 54;

// Compact, print-scale sizing — deliberately smaller than the editing
// view's MEASURE_WIDTH/STAVE_ROW_HEIGHT, which are oversized for
// on-screen click targets, not for fitting real systems on a page.
const PRINT_MEASURE_WIDTH_PT = 140;
// 70pt/row + the gap below fits two 4-part systems per Letter page
// (2*(4*70+24) = 632pt of 684pt usable) — real hymnals' usual layout.
const PRINT_STAVE_ROW_HEIGHT_PT = 70;
const SYSTEM_GAP_PT = 24;

// Just the rows' own ink — callers add SYSTEM_GAP_PT to get the actual
// vertical stride from one system to the next.
function rowsHeight(rowCount: number): number {
  return rowCount * PRINT_STAVE_ROW_HEIGHT_PT;
}

/**
 * Renders `score` into `container` as one `<div class="page">` per printed
 * page, each holding one `<svg>` sized to US Letter with `PAGE_MARGIN_PT`
 * baked into its own coordinate space — the fixed DOM shape SPEC.md §8
 * calls for, so `io/print.css`'s page breaks and a future jsPDF path both
 * work off it unchanged. Pure layout planning lives in `paginate.ts`; this
 * is just VexFlow drawing on top of that plan. Lyrics aren't drawn here yet
 * — print is scoped to notes/rhythm for now, matching the same "pitches
 * and rhythms over visual fidelity" bar SPEC.md sets for MusicXML export.
 */
export function renderPrintPages(container: HTMLElement, score: Score): void {
  container.replaceChildren();
  const usableWidth = PAGE_WIDTH_PT - PAGE_MARGIN_PT * 2;
  const usableHeight = PAGE_HEIGHT_PT - PAGE_MARGIN_PT * 2;
  const baseRows = buildRowSetups(score);
  const systemHeight = rowsHeight(baseRows.length) + SYSTEM_GAP_PT;

  const pages = paginate(score, {
    measureWidth: PRINT_MEASURE_WIDTH_PT,
    systemWidth: usableWidth,
    systemHeight,
    pageHeight: usableHeight,
  });

  for (const page of pages) {
    const pageDiv = document.createElement("div");
    pageDiv.className = "page";
    container.append(pageDiv);

    const renderer = new Renderer(pageDiv, Renderer.Backends.SVG);
    renderer.resize(PAGE_WIDTH_PT, PAGE_HEIGHT_PT);
    const ctx = renderer.getContext();
    // Renderer.resize() sets width/height attributes but not viewBox — CSS
    // scaling the SVG to the printed page's width needs one, or the print
    // comes out squashed (SPEC.md §8).
    pageDiv
      .querySelector("svg")!
      .setAttribute("viewBox", `0 0 ${PAGE_WIDTH_PT} ${PAGE_HEIGHT_PT}`);

    page.systems.forEach((measureIndices, systemIndex) => {
      const rows: RowSetup[] = baseRows.map((base, rowIndex) => ({
        ...base,
        y:
          PAGE_MARGIN_PT +
          systemIndex * systemHeight +
          rowIndex * PRINT_STAVE_ROW_HEIGHT_PT,
      }));
      measureIndices.forEach((measureIndex, indexInSystem) => {
        const x = PAGE_MARGIN_PT + indexInSystem * PRINT_MEASURE_WIDTH_PT;
        drawMeasureColumn(
          ctx,
          score,
          rows,
          measureIndex,
          x,
          PRINT_MEASURE_WIDTH_PT,
          indexInSystem === 0,
        );
      });
    });
  }
}
