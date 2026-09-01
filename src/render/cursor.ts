import { diatonicToY, hitTest, tickToX } from "./hit-test.ts";
import type { LayoutIndex } from "./layout-index.ts";

const GHOST_NOTE_RX = 4.5;
const GHOST_NOTE_RY = 3.5;
const GHOST_NOTE_TILT_DEGREES = -20;

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
 * mousemove, snaps to `gridTicks` via `hitTest` and positions a semi-
 * transparent notehead there; hides it when the cursor isn't over a stave.
 * `getLayoutIndex` is called per move rather than captured once, so this
 * keeps working across re-renders (layout toggle, future edits) without
 * needing to be re-attached. Returns a cleanup function.
 */
export function attachGhostNote(
  container: HTMLElement,
  getLayoutIndex: () => LayoutIndex,
  gridTicks: number,
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
    const hit = hitTest(x, y, getLayoutIndex(), gridTicks);
    const ghostX = hit && tickToX(hit.tick, hit.box);
    if (!hit || ghostX === null) {
      ghost.style.display = "none";
      return;
    }

    const ghostY = diatonicToY(hit.diatonic, hit.box);
    ghost.setAttribute("cx", String(ghostX));
    ghost.setAttribute("cy", String(ghostY));
    ghost.setAttribute(
      "transform",
      `rotate(${GHOST_NOTE_TILT_DEGREES} ${ghostX} ${ghostY})`,
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
