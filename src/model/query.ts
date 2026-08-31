import type { MeasureSpec, NoteEvent, Score } from "./score.ts";

function ticksPerMeasure(measure: MeasureSpec, divisions: number): number {
  return (measure.timeSig.beats * divisions * 4) / measure.timeSig.beatType;
}

/**
 * Exclusive end tick of `measure` — next measure's start, or computed from
 * its own time signature.
 */
export function measureEndTick(score: Score, measure: MeasureSpec): number {
  const next = score.measures[measure.index + 1];
  return next
    ? next.startTick
    : measure.startTick + ticksPerMeasure(measure, score.divisions);
}

/**
 * Returns the measure that contains the given tick.
 */
export function measureAt(score: Score, tick: number): MeasureSpec {
  const measure = score.measures.findLast(
    (candidate) => candidate.startTick <= tick,
  );
  if (!measure) throw new Error(`No measure covers tick ${tick}`);
  return measure;
}

/**
 * Returns the key signature at the given tick.
 */
export function keyAt(score: Score, tick: number): number {
  return measureAt(score, tick).keyFifths;
}

/**
 * Returns the time signature at the given tick.
 */
export function timeAt(score: Score, tick: number): MeasureSpec["timeSig"] {
  return measureAt(score, tick).timeSig;
}

/**
 * Returns the events in the given part that occur in the given measure.
 */
export function eventsForMeasure(
  score: Score,
  partId: string,
  measureIndex: number,
): NoteEvent[] {
  const measure = score.measures[measureIndex];
  if (!measure) throw new Error(`No measure at index ${measureIndex}`);
  const part = score.parts.find((candidate) => candidate.id === partId);
  if (!part) throw new Error(`No part with id ${partId}`);

  const endTick = measureEndTick(score, measure);
  return part.events.filter(
    (event) => event.tick >= measure.startTick && event.tick < endTick,
  );
}
