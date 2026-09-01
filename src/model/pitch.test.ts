import { describe, expect, it } from "vitest";
import { fromDiatonic, toDiatonic, toMidi } from "./pitch.ts";
import type { Pitch } from "./score.ts";

describe("toDiatonic / fromDiatonic", () => {
  it("round-trips every step across octaves 0-8", () => {
    const steps: Pitch["step"][] = ["C", "D", "E", "F", "G", "A", "B"];
    for (let octave = 0; octave <= 8; octave++) {
      for (const step of steps) {
        const diatonic = toDiatonic({ step, alter: 0, octave });
        expect(fromDiatonic(diatonic)).toEqual({ step, octave });
      }
    }
  });

  it("places middle C at octave 4", () => {
    expect(
      fromDiatonic(toDiatonic({ step: "C", alter: 0, octave: 4 })),
    ).toEqual({
      step: "C",
      octave: 4,
    });
  });
});

describe("toMidi", () => {
  it("agrees on enharmonic spellings of the same key", () => {
    const fSharp4: Pitch = { step: "F", alter: 1, octave: 4 };
    const gFlat4: Pitch = { step: "G", alter: -1, octave: 4 };
    expect(toMidi(fSharp4)).toBe(toMidi(gFlat4));
  });

  it("puts middle C at MIDI 60", () => {
    expect(toMidi({ step: "C", alter: 0, octave: 4 })).toBe(60);
  });
});
