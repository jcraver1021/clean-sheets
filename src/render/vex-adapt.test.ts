import { Stem } from "vexflow";
import { describe, expect, it } from "vitest";
import {
  stemFor,
  toVexDuration,
  toVexKey,
  toVexKeySignature,
} from "./vex-adapt.ts";

describe("toVexKey", () => {
  it("converts a diatonic index to a VexFlow key", () => {
    expect(toVexKey(28, 0)).toBe("c/4"); // middle C
    expect(toVexKey(38, 0)).toBe("f/5");
  });

  it("carries every accidental through", () => {
    expect(toVexKey(38, 1)).toBe("f#/5");
    expect(toVexKey(38, -1)).toBe("fb/5");
    expect(toVexKey(38, 2)).toBe("f##/5");
    expect(toVexKey(38, -2)).toBe("fbb/5");
  });
});

describe("toVexDuration", () => {
  const DIVISIONS = 960;

  it("resolves the plain base durations", () => {
    expect(toVexDuration(3840, DIVISIONS)).toEqual({ duration: "1", dots: 0 });
    expect(toVexDuration(1920, DIVISIONS)).toEqual({ duration: "2", dots: 0 });
    expect(toVexDuration(960, DIVISIONS)).toEqual({ duration: "4", dots: 0 });
    expect(toVexDuration(480, DIVISIONS)).toEqual({ duration: "8", dots: 0 });
  });

  it("resolves dotted and double-dotted durations", () => {
    expect(toVexDuration(1440, DIVISIONS)).toEqual({ duration: "4", dots: 1 }); // dotted quarter
    expect(toVexDuration(1680, DIVISIONS)).toEqual({ duration: "4", dots: 2 }); // double-dotted quarter
  });

  it("throws for a duration with no exact match, e.g. a triplet", () => {
    expect(() => toVexDuration(640, DIVISIONS)).toThrow(
      /no exact VexFlow duration/,
    );
  });
});

describe("stemFor", () => {
  it("defers to VexFlow's automatic stemming for a single voice", () => {
    expect(stemFor(1, 0)).toBeUndefined();
  });

  it("alternates up/down by position across multiple voices", () => {
    expect(stemFor(2, 0)).toBe(Stem.UP);
    expect(stemFor(2, 1)).toBe(Stem.DOWN);
    expect(stemFor(4, 2)).toBe(Stem.UP);
    expect(stemFor(4, 3)).toBe(Stem.DOWN);
  });
});

describe("toVexKeySignature", () => {
  it("maps keyFifths to the matching key name", () => {
    expect(toVexKeySignature(0)).toBe("C");
    expect(toVexKeySignature(2)).toBe("D");
    expect(toVexKeySignature(-3)).toBe("Eb");
    expect(toVexKeySignature(7)).toBe("C#");
    expect(toVexKeySignature(-7)).toBe("Cb");
  });

  it("throws outside the -7..7 range", () => {
    expect(() => toVexKeySignature(8)).toThrow(/out of the -7..7 range/);
    expect(() => toVexKeySignature(-8)).toThrow(/out of the -7..7 range/);
  });
});
