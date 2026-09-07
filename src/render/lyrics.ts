import { currentSyllable, versesInPart } from "../model/lyrics.ts";
import type { NoteEvent, Part, Score } from "../model/score.ts";
import type { MeasureBox } from "./layout-index.ts";
import type { RowSetup } from "./renderer.ts";

export const LYRIC_LINE_HEIGHT = 20;

/**
 * Lyric lines a row needs reserved below its stave: one per verse for
 * `perPart` display, none for `shared` (that gets one block below the
 * whole system instead — see `sharedLyricLineCount`).
 */
export function lyricLinesForRow(
  score: Score,
  partId: string | undefined,
): number {
  if (score.lyricDisplay.kind !== "perPart" || !partId) return 0;
  const part = score.parts.find((candidate) => candidate.id === partId);
  return part ? versesInPart(part).length : 0;
}

/**
 * Lyric lines the `shared` display needs below the whole system — 0 unless
 * `lyricDisplay.kind === "shared"`.
 */
export function sharedLyricLineCount(score: Score): number {
  const lyricDisplay = score.lyricDisplay;
  if (lyricDisplay.kind !== "shared") return 0;
  const part = score.parts.find(
    (candidate) => candidate.id === lyricDisplay.sourcePartId,
  );
  return part ? versesInPart(part).length : 0;
}

function xForTick(measures: MeasureBox[], tick: number): number | null {
  const measure = measures.find((m) => tick >= m.startTick && tick < m.endTick);
  return measure?.noteAnchors.find((anchor) => anchor.tick === tick)?.x ?? null;
}

// Dataset keys double as the highlight overlay's only way to find "the
// syllable for (partId, verse, tick)" after a re-render recreates every
// element — see attachLyricHighlight.
function createSyllableText(
  partId: string,
  verse: number,
  tick: number,
  x: number,
  y: number,
  text: string,
): SVGTextElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "text");
  el.setAttribute("x", String(x));
  el.setAttribute("y", String(y));
  el.setAttribute("font-size", "13");
  el.dataset["lyricPartId"] = partId;
  el.dataset["lyricVerse"] = String(verse);
  el.dataset["lyricTick"] = String(tick);
  el.textContent = text;
  return el;
}

/**
 * Draws one part's lyric lines (one row per verse) anchored to `measures`'
 * real note x-positions, starting at `topY`. Only events with real text get
 * a glyph — a melisma's held notes carry an empty-text `Lyric` on purpose
 * (model/lyrics.ts), so they're silent here; `currentSyllable` is what
 * still finds the right syllable to highlight while they sound.
 */
function drawPartLyrics(
  svg: SVGSVGElement,
  partId: string,
  events: NoteEvent[],
  verses: number[],
  measures: MeasureBox[],
  topY: number,
): void {
  verses.forEach((verse, verseIndex) => {
    const y = topY + verseIndex * LYRIC_LINE_HEIGHT + LYRIC_LINE_HEIGHT * 0.75;
    for (const event of events) {
      const lyric = event.lyrics?.find(
        (candidate) => candidate.verse === verse,
      );
      if (!lyric || lyric.text === "") continue;
      const x = xForTick(measures, event.tick);
      if (x === null) continue;
      const hyphen =
        lyric.syllable === "begin" || lyric.syllable === "middle" ? "-" : "";
      svg.append(
        createSyllableText(
          partId,
          verse,
          event.tick,
          x,
          y,
          lyric.text + hyphen,
        ),
      );
    }
  });
}

/**
 * Draws every lyric line `score.lyricDisplay` calls for: one line per verse
 * under each row (`perPart`) or one shared block under the whole system
 * (`shared`, using `sourcePartId`'s words). `staveRowHeight` and
 * `systemLyricsY` come from `renderScore`'s own layout math, so the lines
 * land exactly where that math reserved space for them.
 */
export function drawLyrics(
  container: HTMLElement,
  score: Score,
  rows: RowSetup[],
  measuresByRow: MeasureBox[][],
  staveRowHeight: number,
  systemLyricsY: number,
): void {
  const svg = container.querySelector("svg");
  if (!svg) return;

  if (score.lyricDisplay.kind === "perPart") {
    rows.forEach((row, rowIndex) => {
      const partId = row.assignment.partIds[0];
      const part = partId
        ? score.parts.find((candidate) => candidate.id === partId)
        : undefined;
      if (!part) return;
      const verses = versesInPart(part);
      if (verses.length === 0) return;
      drawPartLyrics(
        svg,
        part.id,
        part.events,
        verses,
        measuresByRow[rowIndex]!,
        row.y + staveRowHeight,
      );
    });
    return;
  }

  const lyricDisplay = score.lyricDisplay;
  const part = score.parts.find(
    (candidate) => candidate.id === lyricDisplay.sourcePartId,
  );
  if (!part) return;
  const verses = versesInPart(part);
  if (verses.length === 0) return;
  drawPartLyrics(
    svg,
    part.id,
    part.events,
    verses,
    measuresByRow[0]!,
    systemLyricsY,
  );
}

// The parts whose lyrics are actually on screen — shared display only draws
// sourcePartId's words, so only that part's syllables can ever be lit.
function partsToHighlight(score: Score): Part[] {
  const lyricDisplay = score.lyricDisplay;
  if (lyricDisplay.kind !== "shared") return score.parts;
  const part = score.parts.find(
    (candidate) => candidate.id === lyricDisplay.sourcePartId,
  );
  return part ? [part] : [];
}

const HIGHLIGHT_CLASS = "lyric-highlight";

/**
 * Highlights whichever syllable is sounding at `getDisplayTick()` right
 * now, refreshed every animation frame like `attachPlayhead` (never from an
 * audio callback). Re-queries the DOM by the syllable's own (partId, verse,
 * tick) each frame rather than caching element references, since a
 * re-render replaces every lyric `<text>` outright. Returns a cleanup
 * function.
 */
export function attachLyricHighlight(
  container: HTMLElement,
  getScore: () => Score,
  getDisplayTick: () => number | null,
): () => void {
  let lit: Element[] = [];

  function clear(): void {
    lit.forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
    lit = [];
  }

  function draw(): void {
    frame = requestAnimationFrame(draw);
    clear();

    const svg = container.querySelector("svg");
    const tick = getDisplayTick();
    if (!svg || tick === null) return;

    const score = getScore();
    for (const part of partsToHighlight(score)) {
      for (const verse of versesInPart(part)) {
        const result = currentSyllable(part, verse, tick);
        if (!result) continue;
        const el = svg.querySelector(
          `text[data-lyric-part-id="${part.id}"][data-lyric-verse="${verse}"][data-lyric-tick="${result.event.tick}"]`,
        );
        if (el) {
          el.classList.add(HIGHLIGHT_CLASS);
          lit.push(el);
        }
      }
    }
  }
  let frame = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(frame);
    clear();
  };
}
