import { describe, expect, it } from "vitest";
import type { NoteEvent, Part } from "./score.ts";
import { currentSyllable, versesInPart } from "./lyrics.ts";

function event(
  partial: Partial<NoteEvent> & Pick<NoteEvent, "id" | "tick">,
): NoteEvent {
  return { durationTicks: 480, pitches: [], ...partial };
}

describe("versesInPart", () => {
  it("returns nothing for a part with no lyrics", () => {
    const part: Part = {
      id: "P",
      name: "P",
      events: [event({ id: "a", tick: 0 })],
    };
    expect(versesInPart(part)).toEqual([]);
  });

  it("returns every distinct verse, sorted", () => {
    const part: Part = {
      id: "P",
      name: "P",
      events: [
        event({
          id: "a",
          tick: 0,
          lyrics: [
            { verse: 2, syllable: "single", text: "two" },
            { verse: 1, syllable: "single", text: "one" },
          ],
        }),
      ],
    };
    expect(versesInPart(part)).toEqual([1, 2]);
  });
});

describe("currentSyllable", () => {
  it("returns null when nothing sounds at tick", () => {
    const part: Part = {
      id: "P",
      name: "P",
      events: [event({ id: "a", tick: 0 })],
    };
    expect(currentSyllable(part, 1, 480)).toBeNull();
  });

  it("returns null when the sounding note has no lyric for that verse", () => {
    const part: Part = {
      id: "P",
      name: "P",
      events: [
        event({
          id: "a",
          tick: 0,
          lyrics: [{ verse: 2, syllable: "single", text: "x" }],
        }),
      ],
    };
    expect(currentSyllable(part, 1, 0)).toBeNull();
  });

  it("returns the syllable directly on the sounding note", () => {
    const part: Part = {
      id: "P",
      name: "P",
      events: [
        event({
          id: "a",
          tick: 0,
          lyrics: [{ verse: 1, syllable: "single", text: "Ho" }],
        }),
      ],
    };
    const result = currentSyllable(part, 1, 0);
    expect(result?.lyric.text).toBe("Ho");
    expect(result?.event.id).toBe("a");
  });

  it("walks back through a melisma to the syllable that started it", () => {
    const part: Part = {
      id: "P",
      name: "P",
      events: [
        event({
          id: "a",
          tick: 0,
          lyrics: [{ verse: 1, syllable: "begin", text: "Ho" }],
        }),
        event({
          id: "b",
          tick: 480,
          lyrics: [{ verse: 1, syllable: "middle", text: "" }],
        }),
        event({
          id: "c",
          tick: 960,
          lyrics: [{ verse: 1, syllable: "end", text: "" }],
        }),
      ],
    };
    const result = currentSyllable(part, 1, 960);
    expect(result?.lyric.text).toBe("Ho");
    expect(result?.event.id).toBe("a");
  });

  it("stops at a note with no lyric entry at all, even if an earlier one had text", () => {
    const part: Part = {
      id: "P",
      name: "P",
      events: [
        event({
          id: "a",
          tick: 0,
          lyrics: [{ verse: 1, syllable: "single", text: "Ho" }],
        }),
        event({ id: "b", tick: 480 }), // No entry for verse 1 at all — a real gap.
      ],
    };
    expect(currentSyllable(part, 1, 480)).toBeNull();
  });
});
