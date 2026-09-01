import { beforeEach, describe, expect, it } from "vitest";
import {
  commit,
  getRevision,
  getScore,
  initHistory,
  redo,
  undo,
} from "./history.ts";
import type { Score } from "../model/score.ts";

function fixtureScore(): Score {
  return {
    schemaVersion: 1,
    title: "fixture",
    divisions: 960,
    parts: [{ id: "P", name: "Part", events: [] }],
    measures: [
      {
        index: 0,
        startTick: 0,
        timeSig: { beats: 4, beatType: 4 },
        keyFifths: 0,
      },
    ],
    tempoMap: [{ tick: 0, bpm: 96 }],
    layout: { kind: "openScore", staves: [{ clef: "treble", partIds: ["P"] }] },
    lyricDisplay: { kind: "perPart" },
  };
}

describe("edit/history", () => {
  let renderCount = 0;

  beforeEach(() => {
    renderCount = 0;
    initHistory(fixtureScore(), () => {
      renderCount++;
    });
  });

  it("calls the rerender callback on init", () => {
    expect(renderCount).toBe(1);
  });

  it("bumps the revision on init, commit, undo, and redo", () => {
    const afterInit = getRevision();
    commit((s) => {
      s.title = "edited";
    });
    expect(getRevision()).toBe(afterInit + 1);
    undo();
    expect(getRevision()).toBe(afterInit + 2);
    redo();
    expect(getRevision()).toBe(afterInit + 3);
  });

  it("commit mutates the score and triggers a rerender", () => {
    commit((s) => {
      s.title = "edited";
    });
    expect(getScore().title).toBe("edited");
    expect(renderCount).toBe(2); // init + commit
  });

  it("undo restores the previous state; redo replays it", () => {
    commit((s) => {
      s.title = "first";
    });
    commit((s) => {
      s.title = "second";
    });
    undo();
    expect(getScore().title).toBe("first");
    redo();
    expect(getScore().title).toBe("second");
  });

  it("a new commit discards the redo branch", () => {
    commit((s) => {
      s.title = "first";
    });
    undo();
    commit((s) => {
      s.title = "third";
    });
    redo(); // nothing to redo — the "first" branch was discarded
    expect(getScore().title).toBe("third");
  });

  it("undo/redo are no-ops when there's nothing to undo/redo", () => {
    const before = getRevision();
    undo();
    expect(getRevision()).toBe(before);
    redo();
    expect(getRevision()).toBe(before);
  });
});
