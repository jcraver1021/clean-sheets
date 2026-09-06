import { describe, expect, it } from "vitest";
import { soundingAt } from "./audition.ts";
import type { SoundEvent } from "./flatten.ts";

function event(partial: Partial<SoundEvent>): SoundEvent {
  return { partId: "P", tick: 0, durationTicks: 960, midi: 60, ...partial };
}

describe("soundingAt", () => {
  it("includes a note that started at or before tick and hasn't ended", () => {
    const events = [event({ tick: 0, durationTicks: 960 })];
    expect(soundingAt(events, 0)).toEqual(events);
    expect(soundingAt(events, 959)).toEqual(events);
  });

  it("excludes a note ending exactly at tick — half-open interval", () => {
    const events = [event({ tick: 0, durationTicks: 960 })];
    expect(soundingAt(events, 960)).toEqual([]);
  });

  it("excludes a note that hasn't started yet", () => {
    const events = [event({ tick: 960, durationTicks: 960 })];
    expect(soundingAt(events, 959)).toEqual([]);
  });

  it("includes every simultaneous note at a tick", () => {
    const events = [
      event({ partId: "S", tick: 0, durationTicks: 960, midi: 72 }),
      event({ partId: "A", tick: 0, durationTicks: 960, midi: 67 }),
      event({ partId: "B", tick: 480, durationTicks: 960, midi: 48 }),
    ];
    expect(soundingAt(events, 480)).toEqual(events);
  });
});
