import { describe, expect, it } from "vitest";
import { computeClaimRegions } from "./layout-index.ts";

describe("computeClaimRegions", () => {
  it("splits stacked staves halfway between neighbors, with no gaps", () => {
    const regions = computeClaimRegions([100, 200, 320]);
    expect(regions).toEqual([
      { y0: -Infinity, y1: 150 },
      { y0: 150, y1: 260 },
      { y0: 260, y1: Infinity },
    ]);
  });

  it("extends a single stave's claim in both directions", () => {
    expect(computeClaimRegions([100])).toEqual([
      { y0: -Infinity, y1: Infinity },
    ]);
  });
});
