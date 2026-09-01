import type { NoteEvent, Part, Pitch, Score } from "../model/score.ts";

function partOrThrow(score: Score, partId: string): Part {
  const part = score.parts.find((candidate) => candidate.id === partId);
  if (!part) throw new Error(`No part with id ${partId}`);
  return part;
}

function eventOrThrow(part: Part, eventId: string): NoteEvent {
  const event = part.events.find((candidate) => candidate.id === eventId);
  if (!event) throw new Error(`No event with id ${eventId} in part ${part.id}`);
  return event;
}

function coversTick(event: NoteEvent, tick: number): boolean {
  return event.tick <= tick && tick < event.tick + event.durationTicks;
}

function overlapsRange(
  event: NoteEvent,
  startTick: number,
  endTick: number,
): boolean {
  return event.tick < endTick && event.tick + event.durationTicks > startTick;
}

/**
 * Places a note (or chord) at `tick` in `partId`, replacing whatever
 * previously occupied that tick range. A measure's length is fixed by its
 * time signature, so "insert" means overwrite here, not grow the measure —
 * matching typical piano-roll editors, and keeping `Part.events` non-
 * overlapping without needing to split or truncate existing notes.
 */
export function insertNote(
  score: Score,
  partId: string,
  tick: number,
  durationTicks: number,
  pitches: Pitch[],
): void {
  const part = partOrThrow(score, partId);
  const endTick = tick + durationTicks;
  part.events = part.events.filter(
    (event) => !overlapsRange(event, tick, endTick),
  );
  part.events.push({ id: crypto.randomUUID(), tick, durationTicks, pitches });
  part.events.sort((a, b) => a.tick - b.tick);
}

/** Removes whichever event in `partId` covers `tick`, if any. */
export function deleteEventAt(
  score: Score,
  partId: string,
  tick: number,
): void {
  const part = partOrThrow(score, partId);
  part.events = part.events.filter((event) => !coversTick(event, tick));
}

/**
 * Changes an event's duration, clipping (removing) any later events the new
 * duration now overlaps — same overwrite rule as `insertNote`.
 */
export function setDuration(
  score: Score,
  partId: string,
  eventId: string,
  durationTicks: number,
): void {
  const part = partOrThrow(score, partId);
  const event = eventOrThrow(part, eventId);
  const endTick = event.tick + durationTicks;
  part.events = part.events.filter(
    (candidate) =>
      candidate === event || !overlapsRange(candidate, event.tick, endTick),
  );
  event.durationTicks = durationTicks;
}

/** Sets the accidental on one pitch (the first, in a single-pitch event) of an existing event. */
export function setAccidental(
  score: Score,
  partId: string,
  eventId: string,
  alter: Pitch["alter"],
  pitchIndex = 0,
): void {
  const part = partOrThrow(score, partId);
  const event = eventOrThrow(part, eventId);
  const pitch = event.pitches[pitchIndex];
  if (!pitch)
    throw new Error(`Event ${eventId} has no pitch at index ${pitchIndex}`);
  pitch.alter = alter;
}
