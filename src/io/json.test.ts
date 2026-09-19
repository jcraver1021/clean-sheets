import { describe, expect, it } from "vitest";
import type { Score } from "../model/score.ts";
import {
  jsonToScore,
  loadFromLocalStorage,
  saveToLocalStorage,
  scoreToJson,
} from "./json.ts";

function fixtureScore(): Score {
  return {
    schemaVersion: 1,
    title: "fixture",
    divisions: 960,
    parts: [
      {
        id: "P",
        name: "Part",
        events: [
          {
            id: "e0",
            tick: 0,
            durationTicks: 960,
            pitches: [{ step: "C", alter: 0, octave: 4 }],
          },
        ],
      },
    ],
    measures: [
      {
        index: 0,
        startTick: 0,
        timeSig: { beats: 4, beatType: 4 },
        keyFifths: 0,
      },
    ],
    tempoMap: [{ tick: 0, bpm: 96 }],
    layout: { staves: [{ clef: "treble", partIds: ["P"] }] },
    lyricDisplay: { kind: "perPart" },
  };
}

// A minimal in-memory Storage, so localStorage-touching functions are
// testable without jsdom (same DI pattern as platform/fonts.ts).
function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    clear: () => void data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

describe("scoreToJson / jsonToScore", () => {
  it("round-trips a score exactly", () => {
    const score = fixtureScore();
    expect(jsonToScore(scoreToJson(score))).toEqual(score);
  });

  it("throws for an unsupported schemaVersion", () => {
    expect(() => jsonToScore(JSON.stringify({ schemaVersion: 99 }))).toThrow(
      /Unsupported schemaVersion/,
    );
  });

  it("throws for JSON missing schemaVersion entirely", () => {
    expect(() => jsonToScore(JSON.stringify({ title: "no version" }))).toThrow(
      /Unsupported schemaVersion/,
    );
  });
});

describe("saveToLocalStorage / loadFromLocalStorage", () => {
  it("round-trips through the given storage", () => {
    const storage = fakeStorage();
    const score = fixtureScore();
    saveToLocalStorage(score, storage);
    expect(loadFromLocalStorage(storage)).toEqual(score);
  });

  it("returns null when nothing has been saved yet", () => {
    expect(loadFromLocalStorage(fakeStorage())).toBeNull();
  });

  it("returns null (not throw) for a corrupt entry", () => {
    const storage = fakeStorage();
    storage.setItem("clean-sheets:score", "{not json");
    expect(loadFromLocalStorage(storage)).toBeNull();
  });
});
