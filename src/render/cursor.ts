import { diatonicToY, hitTest, tickToX } from "./hit-test.ts";
import type { LayoutIndex } from "./layout-index.ts";

// Measured against a rendered notehead glyph (getBBox()): ~11.8px wide at
// this render scale. Real noteheads are <text> with the default
// text-anchor="start", so their x is the glyph's LEFT edge, not its center —
// unlike an SVG ellipse's cx. Matching that width/anchor convention below
// keeps the ghost's ink over the same span a real note's would occupy.
export const GHOST_NOTE_RX = 6;
const GHOST_NOTE_RY = 3.5;
const GHOST_NOTE_TILT_DEGREES = -20;

export type GhostPosition = { cx: number; cy: number; rotationDegrees: number };

/**
 * Pure positioning math for the ghost note at screen point (x, y): null if
 * nothing claims that point. Split out from `attachGhostNote` so it's
 * testable without a DOM.
 */
export function computeGhostPosition(
  x: number,
  y: number,
  layoutIndex: LayoutIndex,
  gridTicks: number,
): GhostPosition | null {
  const hit = hitTest(x, y, layoutIndex, gridTicks);
  const ghostX = hit && tickToX(hit.tick, hit.box);
  if (!hit || ghostX === null) return null;

  return {
    // +GHOST_NOTE_RX: shift the ellipse's center right by its own radius, so
    // its LEFT edge lands at the anchor x — matching a real notehead glyph's
    // left-anchored rendering instead of centering on it.
    cx: ghostX + GHOST_NOTE_RX,
    cy: diatonicToY(hit.diatonic, hit.box),
    rotationDegrees: GHOST_NOTE_TILT_DEGREES,
  };
}

function createGhostNoteElement(): SVGEllipseElement {
  const ghost = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "ellipse",
  );
  ghost.setAttribute("rx", String(GHOST_NOTE_RX));
  ghost.setAttribute("ry", String(GHOST_NOTE_RY));
  ghost.setAttribute("fill", "rgba(0, 0, 0, 0.35)");
  ghost.style.display = "none";
  ghost.style.pointerEvents = "none";
  return ghost;
}

/**
 * Wires a hover ghost-note preview onto `container`'s rendered SVG: on
 * mousemove, snaps to the current grid via `hitTest` and positions a semi-
 * transparent notehead there; hides it when the cursor isn't over a stave.
 * `getLayoutIndex`/`getGridTicks` are called per move rather than captured
 * once, so this keeps working across re-renders and duration-palette changes
 * without needing to be re-attached. Returns a cleanup function.
 */
export function attachGhostNote(
  container: HTMLElement,
  getLayoutIndex: () => LayoutIndex,
  getGridTicks: () => number,
): () => void {
  const ghost = createGhostNoteElement();

  function currentSvg(): SVGSVGElement | null {
    return container.querySelector("svg");
  }

  function onMouseMove(event: MouseEvent) {
    const svg = currentSvg();
    if (!svg) return;
    if (ghost.parentNode !== svg) svg.append(ghost);

    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const position = computeGhostPosition(
      x,
      y,
      getLayoutIndex(),
      getGridTicks(),
    );
    if (!position) {
      ghost.style.display = "none";
      return;
    }

    ghost.setAttribute("cx", String(position.cx));
    ghost.setAttribute("cy", String(position.cy));
    ghost.setAttribute(
      "transform",
      `rotate(${position.rotationDegrees} ${position.cx} ${position.cy})`,
    );
    ghost.style.display = "";
  }

  function onMouseLeave() {
    ghost.style.display = "none";
  }

  container.addEventListener("mousemove", onMouseMove);
  container.addEventListener("mouseleave", onMouseLeave);

  return () => {
    container.removeEventListener("mousemove", onMouseMove);
    container.removeEventListener("mouseleave", onMouseLeave);
    ghost.remove();
  };
}
