import type {
  Clef,
  Lyric,
  MeasureSpec,
  NoteEvent,
  Part,
  Pitch,
  Score,
  StaveAssignment,
  Step,
  Syllable,
  Tie,
} from "../model/score.ts";
import { pickFile } from "./file-picker.ts";

// Our fixed convention throughout the app (edit/tools.ts's duration
// palette assumes it, among others) — imported durations are rescaled to
// it regardless of the source file's own <divisions>, so an imported score
// behaves identically to a native one everywhere else.
const DIVISIONS = 960;

function textOf(el: Element | Document, selector: string): string | null {
  return el.querySelector(selector)?.textContent ?? null;
}

// The inverse of musicxml-export.ts's xmlClef: G/line2 (no octave change)
// is treble, F/line4 is bass, G/line2 with clef-octave-change -1 is the
// "vocal tenor clef" we call treble8vb. Anything else falls back to
// treble — this app doesn't support other clefs.
function clefFromXml(clefEl: Element | null): Clef {
  if (!clefEl) return "treble";
  const sign = textOf(clefEl, "sign");
  if (sign === "F") return "bass";
  if (sign === "G" && textOf(clefEl, "clef-octave-change") === "-1") {
    return "treble8vb";
  }
  return "treble";
}

function pitchFromXml(pitchEl: Element): Pitch {
  return {
    step: textOf(pitchEl, "step") as Step,
    alter: Number(textOf(pitchEl, "alter") ?? "0") as Pitch["alter"],
    octave: Number(textOf(pitchEl, "octave")),
  };
}

function tieFromXml(noteEl: Element): Tie | undefined {
  const types = [...noteEl.querySelectorAll("tie")].map((tie) =>
    tie.getAttribute("type"),
  );
  const hasStart = types.includes("start");
  const hasStop = types.includes("stop");
  if (hasStart && hasStop) return "both";
  if (hasStart) return "start";
  if (hasStop) return "stop";
  return undefined;
}

// The inverse of musicxml-export.ts's xmlLyrics: a lyric with no <text>
// but an <extend/> is our melisma-continuation marker (model/lyrics.ts) —
// which "middle"/"end" it really is can't be told from one element alone,
// so "middle" is a harmless default (it only affects future embellishment,
// not the playhead-highlight logic that reads it today).
function lyricFromXml(lyricEl: Element): Lyric {
  const verse = Number(lyricEl.getAttribute("number") ?? "1") || 1;
  const text = textOf(lyricEl, "text");
  if (text === null) return { verse, syllable: "middle", text: "" };
  const syllabic = textOf(lyricEl, "syllabic");
  const syllable: Syllable =
    syllabic === "begin" || syllabic === "middle" || syllabic === "end"
      ? syllabic
      : "single";
  return { verse, syllable, text };
}

function partFromXml(
  partEl: Element,
  partId: string,
  partName: string,
): { part: Part; measures: MeasureSpec[]; clef: Clef } {
  const events: NoteEvent[] = [];
  const measures: MeasureSpec[] = [];
  let cursor = 0;
  let keyFifths = 0;
  let timeSig = { beats: 4, beatType: 4 };
  let clef: Clef = "treble";
  let sourceDivisions = DIVISIONS;
  let lastEvent: NoteEvent | undefined;

  const measureElements = [...partEl.querySelectorAll(":scope > measure")];
  measureElements.forEach((measureEl, index) => {
    const attributes = measureEl.querySelector(":scope > attributes");
    if (attributes) {
      const divisions = textOf(attributes, "divisions");
      if (divisions) sourceDivisions = Number(divisions);
      const fifths = textOf(attributes, "key > fifths");
      if (fifths !== null) keyFifths = Number(fifths);
      const beats = textOf(attributes, "time > beats");
      const beatType = textOf(attributes, "time > beat-type");
      if (beats && beatType) {
        timeSig = { beats: Number(beats), beatType: Number(beatType) };
      }
      const clefEl = attributes.querySelector("clef");
      if (clefEl) clef = clefFromXml(clefEl);
    }
    measures.push({ index, startTick: cursor, timeSig, keyFifths });

    for (const noteEl of measureEl.querySelectorAll(":scope > note")) {
      const scale = DIVISIONS / sourceDivisions;
      const durationTicks = Math.round(
        Number(textOf(noteEl, "duration") ?? "0") * scale,
      );
      const pitchEl = noteEl.querySelector(":scope > pitch");

      // A chord member shares its tick with the note before it, rather
      // than advancing the cursor — mirrored from the export side, where
      // every pitch past the first gets a bare <chord/>.
      if (noteEl.querySelector(":scope > chord") && lastEvent && pitchEl) {
        lastEvent.pitches.push(pitchFromXml(pitchEl));
        continue;
      }

      // Explicit rests aren't stored — gaps are implicit everywhere else
      // in this model (renderer.ts's fillGapsWithRests, etc.).
      if (noteEl.querySelector(":scope > rest")) {
        cursor += durationTicks;
        lastEvent = undefined;
        continue;
      }

      const tie = tieFromXml(noteEl);
      const lyrics = [...noteEl.querySelectorAll(":scope > lyric")].map(
        lyricFromXml,
      );
      const event: NoteEvent = {
        id: crypto.randomUUID(),
        tick: cursor,
        durationTicks,
        pitches: pitchEl ? [pitchFromXml(pitchEl)] : [],
        ...(tie ? { tie } : {}),
        ...(lyrics.length > 0 ? { lyrics } : {}),
      };
      events.push(event);
      lastEvent = event;
      cursor += durationTicks;
    }
  });

  return { part: { id: partId, name: partName, events }, measures, clef };
}

/**
 * Converts a MusicXML partwise document to a `Score`. Always lands as one
 * stave per part (SPEC.md §8's own guidance for import, and the only
 * layout this app has now that shared staves are gone — PROGRESS.md).
 * Assumes every part shares the same measure boundaries, which any file
 * that actually plays together will.
 */
export function musicXmlToScore(xml: string): Score {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Malformed MusicXML: ${parserError.textContent}`);
  }

  const partNames = new Map<string, string>();
  for (const scorePart of doc.querySelectorAll("part-list > score-part")) {
    const id = scorePart.getAttribute("id");
    if (id) partNames.set(id, textOf(scorePart, "part-name") ?? id);
  }

  const partElements = [...doc.querySelectorAll("score-partwise > part")];
  if (partElements.length === 0) {
    throw new Error("No <part> elements found");
  }

  const parts: Part[] = [];
  const staves: StaveAssignment[] = [];
  let measures: MeasureSpec[] = [];
  partElements.forEach((partEl, i) => {
    // The file's own "P1"/"P2" ids are only used to look up part names —
    // our Part.id is always freshly generated on import, same as every
    // imported NoteEvent's id.
    const xmlId = partEl.getAttribute("id") ?? `P${i + 1}`;
    const result = partFromXml(
      partEl,
      crypto.randomUUID(),
      partNames.get(xmlId) ?? xmlId,
    );
    parts.push(result.part);
    staves.push({ clef: result.clef, partIds: [result.part.id] });
    if (measures.length === 0) measures = result.measures;
  });

  const soundTempo = doc.querySelector("sound[tempo]");
  const bpm = soundTempo ? Number(soundTempo.getAttribute("tempo")) : 96;
  const composer = textOf(doc, "identification > creator[type='composer']");

  return {
    schemaVersion: 1,
    title:
      textOf(doc, "work > work-title") ??
      textOf(doc, "movement-title") ??
      "Imported score",
    ...(composer ? { composer } : {}),
    divisions: DIVISIONS,
    parts,
    measures,
    tempoMap: [{ tick: 0, bpm }],
    layout: { staves },
    lyricDisplay: { kind: "perPart" },
  };
}

/**
 * Opens the browser's file picker for a `.musicxml` file and calls
 * `onLoad` with the imported score.
 */
export function pickMusicXmlFile(
  onLoad: (score: Score) => void,
  onError: (error: unknown) => void = console.error,
): void {
  pickFile(
    ".musicxml,application/vnd.recordare.musicxml+xml",
    musicXmlToScore,
    onLoad,
    onError,
  );
}
