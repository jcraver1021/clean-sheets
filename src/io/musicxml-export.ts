import { eventsForMeasure, measureEndTick } from "../model/query.ts";
import type {
  Clef,
  MeasureSpec,
  NoteEvent,
  Part,
  Pitch,
  Score,
  Tie,
} from "../model/score.ts";
import { decomposeDurationTicks, toVexDuration } from "../render/vex-adapt.ts";
import { triggerDownload } from "./download.ts";

const MUSICXML_NOTE_TYPES: Record<string, string> = {
  "1": "whole",
  "2": "half",
  "4": "quarter",
  "8": "eighth",
  "16": "16th",
  "32": "32nd",
  "64": "64th",
  "128": "128th",
  "256": "256th",
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Same rest-synthesis idea as renderer.ts's fillGapsWithRests (VexFlow's
// per-voice tick accounting isn't the concern here — MusicXML's `<duration>`
// bookkeeping needs it just as much), duplicated rather than shared across
// the render//io boundary for one ~10-line loop.
function fillGapsWithRests(
  events: NoteEvent[],
  startTick: number,
  endTick: number,
  divisions: number,
): NoteEvent[] {
  const filled: NoteEvent[] = [];
  let cursor = startTick;
  const restAt = (tick: number, durationTicks: number): NoteEvent => ({
    id: "",
    tick,
    durationTicks,
    pitches: [],
  });
  for (const event of events) {
    for (const gap of decomposeDurationTicks(event.tick - cursor, divisions)) {
      filled.push(restAt(cursor, gap));
      cursor += gap;
    }
    filled.push(event);
    cursor = event.tick + event.durationTicks;
  }
  for (const gap of decomposeDurationTicks(endTick - cursor, divisions)) {
    filled.push(restAt(cursor, gap));
    cursor += gap;
  }
  return filled;
}

// Standard MusicXML representation of the "vocal tenor clef" — a treble
// clef read an octave low. `<pitch>` still carries the actual sounding
// octave; clef-octave-change only changes how it's engraved, mirroring how
// the model always stores sounding pitch (model/score.ts).
function xmlClef(clef: Clef): string {
  if (clef === "bass") return "<clef><sign>F</sign><line>4</line></clef>";
  if (clef === "treble8vb") {
    return "<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>";
  }
  return "<clef><sign>G</sign><line>2</line></clef>";
}

function xmlPitch(pitch: Pitch): string {
  const alter = pitch.alter !== 0 ? `<alter>${pitch.alter}</alter>` : "";
  return `<pitch><step>${pitch.step}</step>${alter}<octave>${pitch.octave}</octave></pitch>`;
}

// "both" ties from the previous note AND to the next, so it needs a stop
// and a start together — matching Tie's own doc comment (model/score.ts).
function xmlTie(tie: Tie | undefined, tag: "tie" | "tied"): string {
  if (!tie) return "";
  if (tie === "start") return `<${tag} type="start"/>`;
  if (tie === "stop") return `<${tag} type="stop"/>`;
  return `<${tag} type="stop"/><${tag} type="start"/>`;
}

function xmlNote(
  event: NoteEvent,
  pitch: Pitch | null,
  isChordMember: boolean,
  divisions: number,
): string {
  const { duration: code, dots } = toVexDuration(
    event.durationTicks,
    divisions,
  );
  const type = MUSICXML_NOTE_TYPES[code]!;
  return [
    "<note>",
    isChordMember ? "<chord/>" : "",
    pitch ? xmlPitch(pitch) : "<rest/>",
    `<duration>${event.durationTicks}</duration>`,
    pitch ? xmlTie(event.tie, "tie") : "",
    `<type>${type}</type>`,
    "<dot/>".repeat(dots),
    pitch && event.tie
      ? `<notations>${xmlTie(event.tie, "tied")}</notations>`
      : "",
    "</note>",
  ].join("");
}

function xmlNoteOrChord(event: NoteEvent, divisions: number): string {
  if (event.pitches.length === 0) {
    return xmlNote(event, null, false, divisions);
  }
  return event.pitches
    .map((pitch, i) => xmlNote(event, pitch, i > 0, divisions))
    .join("");
}

function attributesChanged(
  measure: MeasureSpec,
  previous: MeasureSpec | undefined,
): boolean {
  return (
    !previous ||
    previous.keyFifths !== measure.keyFifths ||
    previous.timeSig.beats !== measure.timeSig.beats ||
    previous.timeSig.beatType !== measure.timeSig.beatType
  );
}

function xmlMeasure(
  score: Score,
  part: Part,
  clef: Clef,
  measure: MeasureSpec,
  previous: MeasureSpec | undefined,
): string {
  const isFirst = measure.index === 0;
  const attributes = attributesChanged(measure, previous)
    ? [
        "<attributes>",
        isFirst ? `<divisions>${score.divisions}</divisions>` : "",
        `<key><fifths>${measure.keyFifths}</fifths></key>`,
        `<time><beats>${measure.timeSig.beats}</beats><beat-type>${measure.timeSig.beatType}</beat-type></time>`,
        isFirst ? xmlClef(clef) : "",
        "</attributes>",
      ].join("")
    : "";

  const events = fillGapsWithRests(
    eventsForMeasure(score, part.id, measure.index),
    measure.startTick,
    measureEndTick(score, measure),
    score.divisions,
  );
  const notes = events
    .map((event) => xmlNoteOrChord(event, score.divisions))
    .join("");

  return `<measure number="${measure.index + 1}">${attributes}${notes}</measure>`;
}

function xmlPart(score: Score, part: Part, xmlId: string): string {
  const assignment = score.layout.staves.find((stave) =>
    stave.partIds.includes(part.id),
  );
  const clef = assignment?.clef ?? "treble";

  let previous: MeasureSpec | undefined;
  const measures = score.measures
    .map((measure) => {
      const xml = xmlMeasure(score, part, clef, measure, previous);
      previous = measure;
      return xml;
    })
    .join("");

  return `<part id="${xmlId}">${measures}</part>`;
}

/**
 * Converts a score to a MusicXML 4.0 partwise document. One `<part>` per
 * model `Part` (SPEC.md §8 — even for a shared-staff layout, which doesn't
 * survive the round trip anyway; see PROGRESS.md's deviations). Part ids
 * are positional (`P1`, `P2`, ...) rather than the model's own — those can
 * be arbitrary UUIDs, which aren't valid XML NMTOKENs if they start with a
 * digit.
 */
export function scoreToMusicXml(score: Score): string {
  const xmlIds = score.parts.map((_, i) => `P${i + 1}`);
  const partList = score.parts
    .map(
      (part, i) =>
        `<score-part id="${xmlIds[i]}"><part-name>${escapeXml(part.name)}</part-name></score-part>`,
    )
    .join("");
  const parts = score.parts
    .map((part, i) => xmlPart(score, part, xmlIds[i]!))
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    score.title
      ? `<work><work-title>${escapeXml(score.title)}</work-title></work>`
      : "",
    `<part-list>${partList}</part-list>`,
    parts,
    "</score-partwise>",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Downloads `score` as a `.musicxml` file.
 */
export function downloadMusicXml(score: Score): void {
  triggerDownload(
    new Blob([scoreToMusicXml(score)], {
      type: "application/vnd.recordare.musicxml+xml",
    }),
    `${score.title || "score"}.musicxml`,
  );
}
