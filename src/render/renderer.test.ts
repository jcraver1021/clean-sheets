import { describe, expect, it } from "vitest";
import { createDemoScore } from "../demo-score.ts";
import { drawStaveRow } from "./renderer.ts";
import {
  fakeRenderContext,
  installFakeTextMeasurementCanvas,
} from "./vexflow-mocks.ts";

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
