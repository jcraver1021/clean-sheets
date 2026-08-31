import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Voice,
} from "vexflow";
import type { RenderContext } from "vexflow";
import { toDiatonic } from "../model/pitch.ts";
import { eventsForMeasure, keyAt } from "../model/query.ts";
import type {
  Clef,
  NoteEvent,
  Score,
  StaveAssignment,
} from "../model/score.ts";
import {
  stemFor,
  toVexDuration,
  toVexKey,
  toVexKeySignature,
} from "./vex-adapt.ts";

// Model stores sounding pitch (score.ts). treble8vb is written a diatonic 7th
// above sounding — this is one of two places applying that shift; hit-test.ts
// (Stage 2) applies it in reverse.
const TREBLE_8VB_WRITTEN_SHIFT = 7;

const MEASURE_WIDTH = 220;
const STAVE_ROW_HEIGHT = 110;
const SYSTEM_LEFT_MARGIN = 10;
const SYSTEM_TOP_MARGIN = 20;

/**
 * VexFlow has no `treble8vb` — it's `treble` with a cosmetic `8vb` annotation
 * (see `Clef`).
 */
function toVexClefName(clef: Clef): string {
  return clef === "treble8vb" ? "treble" : clef;
}

function buildStaveNote(
  event: NoteEvent,
  score: Score,
  vexClef: string,
  writtenShift: number,
  stemDirection: number | undefined,
): StaveNote {
  const { duration, dots } = toVexDuration(
    event.durationTicks,
    score.divisions,
  );
  if (event.pitches.length === 0) {
    return new StaveNote({
      keys: ["b/4"],
      duration,
      dots,
      type: "r",
      clef: vexClef,
    });
  }
  const keys = event.pitches.map((pitch) =>
    toVexKey(toDiatonic(pitch) + writtenShift, pitch.alter),
  );
  return new StaveNote({ keys, duration, dots, clef: vexClef, stemDirection });
}

function buildVoiceForPart(
  score: Score,
  partId: string,
  measureIndex: number,
  vexClef: string,
  writtenShift: number,
  stemDirection: number | undefined,
): Voice {
  const measure = score.measures[measureIndex];
  if (!measure) throw new Error(`No measure at index ${measureIndex}`);
  const notes = eventsForMeasure(score, partId, measureIndex).map((event) =>
    buildStaveNote(event, score, vexClef, writtenShift, stemDirection),
  );
  const voice = new Voice({
    numBeats: measure.timeSig.beats,
    beatValue: measure.timeSig.beatType,
  }).setStrict(false);
  voice.addTickables(notes);
  return voice;
}

function drawStaveRow(
  ctx: RenderContext,
  score: Score,
  assignment: StaveAssignment,
  rowIndex: number,
): void {
  const vexClef = toVexClefName(assignment.clef);
  const writtenShift =
    assignment.clef === "treble8vb" ? TREBLE_8VB_WRITTEN_SHIFT : 0;
  const y = SYSTEM_TOP_MARGIN + rowIndex * STAVE_ROW_HEIGHT;

  for (
    let measureIndex = 0;
    measureIndex < score.measures.length;
    measureIndex++
  ) {
    const measure = score.measures[measureIndex];
    if (!measure) throw new Error(`No measure at index ${measureIndex}`);
    const x = SYSTEM_LEFT_MARGIN + measureIndex * MEASURE_WIDTH;
    const stave = new Stave(x, y, MEASURE_WIDTH);
    if (measureIndex === 0) {
      // '8vb' is cosmetic; TREBLE_8VB_WRITTEN_SHIFT does the transposing.
      stave.addClef(
        vexClef,
        "default",
        assignment.clef === "treble8vb" ? "8vb" : undefined,
      );
      stave.addTimeSignature(
        `${measure.timeSig.beats}/${measure.timeSig.beatType}`,
      );
    }
    stave.setContext(ctx).draw();

    const voices = assignment.partIds.map((partId, indexInStave) =>
      buildVoiceForPart(
        score,
        partId,
        measureIndex,
        vexClef,
        writtenShift,
        stemFor(assignment.partIds.length, indexInStave),
      ),
    );

    Accidental.applyAccidentals(
      voices,
      toVexKeySignature(keyAt(score, measure.startTick)),
    );
    new Formatter().joinVoices(voices).format(voices, MEASURE_WIDTH - 20);
    voices.forEach((voice) => voice.draw(ctx, stave));
  }
}

/**
 * Draws `score` into `container` as SVG, one row per stave in the layout.
 */
export function renderScore(container: HTMLDivElement, score: Score): void {
  container.replaceChildren();
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(
    SYSTEM_LEFT_MARGIN * 2 + score.measures.length * MEASURE_WIDTH,
    SYSTEM_TOP_MARGIN + score.layout.staves.length * STAVE_ROW_HEIGHT,
  );
  const ctx = renderer.getContext();

  score.layout.staves.forEach((assignment, rowIndex) =>
    drawStaveRow(ctx, score, assignment, rowIndex),
  );
}
