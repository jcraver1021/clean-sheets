import { describe, expect, it } from "vitest";
import { alterFromKeyFifths } from "./key.ts";

describe("alterFromKeyFifths", () => {
  it("returns natural for C major (no sharps or flats)", () => {
    for (const step of ["C", "D", "E", "F", "G", "A", "B"] as const) {
      expect(alterFromKeyFifths(step, 0)).toBe(0);
    }
  });

  it("sharpens only the steps a sharp key has added, in order", () => {
    // D major (2 sharps): F# and C#, nothing else.
    expect(alterFromKeyFifths("F", 2)).toBe(1);
    expect(alterFromKeyFifths("C", 2)).toBe(1);
    expect(alterFromKeyFifths("G", 2)).toBe(0);
  });

  it("flattens only the steps a flat key has added, in order", () => {
    // Eb major (3 flats): Bb, Eb, Ab, nothing else.
    expect(alterFromKeyFifths("B", -3)).toBe(-1);
    expect(alterFromKeyFifths("E", -3)).toBe(-1);
    expect(alterFromKeyFifths("A", -3)).toBe(-1);
    expect(alterFromKeyFifths("D", -3)).toBe(0);
  });
});
