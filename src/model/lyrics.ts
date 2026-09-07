import type { Lyric, NoteEvent, Part } from "./score.ts";

/**
 * Every distinct verse number with at least one lyric anywhere in `part`,
 * sorted ascending — how many lyric lines a display needs, and in what
 * order.
 */
export function versesInPart(part: Part): number[] {
  const verses = new Set<number>();
  for (const event of part.events) {
    for (const lyric of event.lyrics ?? []) verses.add(lyric.verse);
  }
  return [...verses].sort((a, b) => a - b);
}

/**
 * The syllable of `verse` sounding in `part` at `tick` — half-open like
 * `soundingAt` (audio/audition.ts). A melisma note carries an empty-text
 * `Lyric` marking "still the previous syllable" rather than starting a new
 * one, so this walks backward to the nearest event with real text; a note
 * with no entry at all for `verse` breaks the run.
 */
export function currentSyllable(
  part: Part,
  verse: number,
  tick: number,
): { event: NoteEvent; lyric: Lyric } | null {
  const index = part.events.findIndex(
    (event) => event.tick <= tick && tick < event.tick + event.durationTicks,
  );
  if (index === -1) return null;

  for (let i = index; i >= 0; i--) {
    const event = part.events[i]!;
    const lyric = event.lyrics?.find((candidate) => candidate.verse === verse);
    if (!lyric) return null;
    if (lyric.text !== "") return { event, lyric };
  }
  return null;
}
