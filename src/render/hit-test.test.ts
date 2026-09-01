import { describe, expect, it } from "vitest";
import { hitTest, tickToX, xToTick, yToDiatonic } from "./hit-test.ts";
import type { StaveBox } from "./layout-index.ts";

const LINE_SPACING = 10;

function box(overrides: Partial<StaveBox>): StaveBox {
  return {
    systemIndex: 0,
    staveIndex: 0,
    clef: "treble",
    partIds: ["P"],
    x0: 0,
    x1: 200,
    y0: -Infinity,
    y1: Infinity,
    topLineY: 100,
    lineSpacing: LINE_SPACING,
    measures: [{ index: 0, x0: 0, x1: 200, startTick: 0, endTick: 3840 }],
    ...overrides,
  };
}

describe("yToDiatonic", () => {
  // Verified numerically (§5): reproduces F5-D5-B4-G4-E4 on treble,
  // A3-F3-D3-B2-G2 on bass, F4-D4-B3-G3-E3 sounding on treble8vb.
  it("reads down the treble stave's lines", () => {
    const treble = box({ clef: "treble" });
    const linesTopToBottom = [0, 1, 2, 3, 4].map((line) =>
      yToDiatonic(100 + line * LINE_SPACING, treble),
    );
    expect(linesTopToBottom.map((d) => d % 7)).toEqual([3, 1, 6, 4, 2]); // F, D, B, G, E
  });

  it("reads down the bass stave's lines", () => {
    const bass = box({ clef: "bass", topLineY: 100 });
    const linesTopToBottom = [0, 1, 2, 3, 4].map((line) =>
      yToDiatonic(100 + line * LINE_SPACING, bass),
    );
    expect(linesTopToBottom.map((d) => d % 7)).toEqual([5, 3, 1, 6, 4]); // A, F, D, B, G
  });

  it("returns sounding pitch on treble8vb, an octave below what's written", () => {
    const treble8vb = box({ clef: "treble8vb", topLineY: 100 });
    // Same half-step math as treble (same visual lines), but every result
    // sits a diatonic 7th (octave) lower because it's sounding, not written.
    const treble = box({ clef: "treble", topLineY: 100 });
    for (const y of [100, 105, 110, 130]) {
      expect(yToDiatonic(y, treble8vb)).toBe(yToDiatonic(y, treble) - 7);
    }
  });

  it("keeps working below the last ledger line, past the stave's ink", () => {
    // Middle C sits on the first ledger line below the treble stave, five
    // half-line-spacings below the top line.
    const treble = box({ clef: "treble", topLineY: 100 });
    const middleC = 4 * 7 + 0;
    expect(yToDiatonic(100 + 5 * LINE_SPACING, treble)).toBe(middleC);
  });
});

describe("xToTick", () => {
  it("maps linearly across the measure and snaps to the grid", () => {
    const b = box({
      measures: [{ index: 0, x0: 0, x1: 200, startTick: 0, endTick: 3840 }],
    });
    expect(xToTick(0, b, 960)).toBe(0);
    expect(xToTick(100, b, 960)).toBe(1920); // halfway -> beat 2 of 4
  });

  it("clamps to the last full grid slot when the grid is coarser than the bar", () => {
    // 3/4 bar (2880 ticks) with a half-note (960*2) grid doesn't divide evenly;
    // clicking at the very end must not overshoot into the next measure.
    const b = box({
      measures: [{ index: 0, x0: 0, x1: 200, startTick: 0, endTick: 2880 }],
    });
    expect(xToTick(200, b, 1920)).toBe(960); // 2880 - 1920, not 2880
  });

  it("returns null outside every measure", () => {
    const b = box({
      measures: [{ index: 0, x0: 0, x1: 200, startTick: 0, endTick: 3840 }],
    });
    expect(xToTick(300, b, 960)).toBeNull();
  });
});

describe("tickToX / diatonic round trip with hitTest", () => {
  it("tickToX is the inverse of xToTick at grid points", () => {
    const b = box({});
    for (const tick of [0, 960, 1920, 2880]) {
      const x = tickToX(tick, b)!;
      expect(xToTick(x, b, 960)).toBe(tick);
    }
  });

  it("hitTest finds the right stave and resolves both conversions together", () => {
    const idx = { staves: [box({ y0: -Infinity, y1: Infinity })] };
    const hit = hitTest(50, 105, idx, 960);
    expect(hit).not.toBeNull();
    expect(hit!.tick).toBe(960);
    expect(hit!.diatonic).toBe(yToDiatonic(105, idx.staves[0]!));
  });

  it("returns null when nothing claims that point", () => {
    const idx = { staves: [box({ x0: 0, x1: 200, y0: 0, y1: 50 })] };
    expect(hitTest(50, 500, idx, 960)).toBeNull();
  });
});
