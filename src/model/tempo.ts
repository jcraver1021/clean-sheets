import type { Score } from "./score.ts";

/**
 * Elapsed seconds from score start to `tick`, honoring every tempo change
 * along the way. `tempoMap` invariant: non-empty, sorted, `tempoMap[0].tick
 * === 0` (score.ts).
 */
export function tickToSeconds(score: Score, tick: number): number {
  const { divisions, tempoMap } = score;
  let seconds = 0;
  for (let i = 0; i < tempoMap.length && tempoMap[i]!.tick < tick; i++) {
    const segment = tempoMap[i]!;
    const segmentEnd = Math.min(tempoMap[i + 1]?.tick ?? tick, tick);
    if (segmentEnd <= segment.tick) continue; // Duplicate tick: instantaneous change.
    seconds += ((segmentEnd - segment.tick) / divisions) * (60 / segment.bpm);
  }
  return seconds;
}

/**
 * Inverse of `tickToSeconds` — the tick sounding `seconds` after score
 * start. Used for the playhead, which must convert *absolute* elapsed time
 * (audio/playback.ts), not time relative to wherever playback started.
 */
export function secondsToTick(score: Score, seconds: number): number {
  const { divisions, tempoMap } = score;
  let elapsed = 0;
  let i = 0;
  for (; i < tempoMap.length - 1; i++) {
    const segmentTicks = tempoMap[i + 1]!.tick - tempoMap[i]!.tick;
    if (segmentTicks <= 0) continue; // Duplicate tick.
    const segmentSeconds = (segmentTicks / divisions) * (60 / tempoMap[i]!.bpm);
    if (seconds < elapsed + segmentSeconds) break; // Target falls in this segment.
    elapsed += segmentSeconds;
  }
  const segment = tempoMap[Math.min(i, tempoMap.length - 1)]!;
  return segment.tick + ((seconds - elapsed) / (60 / segment.bpm)) * divisions;
}
