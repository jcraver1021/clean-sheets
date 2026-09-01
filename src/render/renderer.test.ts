import { Element } from "vexflow";
import type { RenderContext } from "vexflow";
import { describe, expect, it } from "vitest";
import { createDemoScore } from "../demo-score.ts";
import { drawStaveRow } from "./renderer.ts";

// VexFlow measures every glyph via a real <canvas> 2D context
// (Element.measureText); a fake one just needs consistent non-zero widths so
// relative layout math (does a clef/time signature's width get accounted
// for?) is still observable without a browser.
function installFakeTextMeasurementCanvas() {
  const context = {
    font: "",
    measureText: (text: string) => ({
      width: text.length * 20,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      fontBoundingBoxAscent: 8,
      fontBoundingBoxDescent: 2,
    }),
  };
  Element.setTextMeasurementCanvas({
    getContext: () => context,
  } as unknown as HTMLCanvasElement);
}

// A no-op RenderContext: drawStaveRow calls real draw()/format() methods on
// real VexFlow objects, which need *some* context to draw into, but nothing
// here reads the drawn output — only the returned StaveBox's geometry does.
function fakeRenderContext(): RenderContext {
  const chainable = new Proxy(
    {},
    {
      get: (_target, prop) =>
        prop === "measureText" ? () => ({ width: 0 }) : () => chainable,
    },
  );
  return chainable as RenderContext;
}

describe("drawStaveRow", () => {
  installFakeTextMeasurementCanvas();

  it("keeps every note's real position within its own measure's bounds", () => {
    const score = createDemoScore();
    const box = drawStaveRow(
      fakeRenderContext(),
      score,
      score.layout.staves[0]!,
      0,
    );

    for (const measure of box.measures) {
      for (const anchor of measure.noteAnchors) {
        expect(anchor.x).toBeGreaterThanOrEqual(measure.x0);
        expect(anchor.x).toBeLessThanOrEqual(measure.x1);
      }
    }
  });
});
