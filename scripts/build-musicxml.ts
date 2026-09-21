/// <reference types="node" />
import { DOMParser } from "linkedom";
import { readFileSync, writeFileSync } from "node:fs";
import { scoreToMusicXml } from "../src/io/musicxml-export.ts";
import { musicXmlToScore } from "../src/io/musicxml-import.ts";
import type {
  Clef,
  NoteEvent,
  Part,
  Pitch,
  Score,
  Step,
  TimeSignature,
} from "../src/model/score.ts";

// musicxml-import.ts calls the global `DOMParser` (never imports one, since
// it's meant to run in a browser) — this is the one place that matters:
// swap in a Node-compatible implementation before it's ever called, so
// insert mode can reuse that parser unmodified.
globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;

const DIVISIONS = 960; // Same fixed convention as the rest of the app (model/score.ts).
const WHOLE_TICKS = DIVISIONS * 4;

// Simple text format:
//
//   title: The Wellerman
//   tempo: 120
//   time: 4/4
//   key: 0
//
//   part: Soprano
//   clef: treble
//   C5/4 D5/4 E5/4 C5/4 | G4/2 F4/4 E4/4 |
//
// One or more `part:`/`clef:` blocks, each followed by lines of
// whitespace-separated note tokens; `|` is a mandatory measure separator
// (simpler and less error-prone than inferring measure boundaries from a
// running tick total). A token is `<pitch>/<durationCode>[.]` — pitch is
// `<STEP><accidental?><octave>` (chords via `+`, e.g. `C4+E4+G4`), rest is
// `R`, durationCode is `1`(whole)..`64`, `.` dots it. No ties or lyrics in
// v1 — every token is self-contained, so both are easy to add later.

type ParsedPart = {
  name: string;
  clef: Clef;
  events: NoteEvent[];
  measureCount: number;
};

type ParsedFile = {
  title?: string;
  composer?: string;
  tempo?: number;
  timeSig: TimeSignature;
  keyFifths: number;
  parts: ParsedPart[];
};

const CLEFS: readonly Clef[] = ["treble", "bass", "treble8vb"];

function isClef(value: string): value is Clef {
  return (CLEFS as readonly string[]).includes(value);
}

function parseTimeSig(value: string): TimeSignature {
  const match = /^(\d+)\/(\d+)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid time signature: "${value}"`);
  return { beats: Number(match[1]), beatType: Number(match[2]) };
}

function measureLengthTicks(timeSig: TimeSignature): number {
  return timeSig.beats * (WHOLE_TICKS / timeSig.beatType);
}

const ALTER_BY_SYMBOL: Record<string, Pitch["alter"]> = {
  "": 0,
  "#": 1,
  "##": 2,
  b: -1,
  bb: -2,
};

const PITCH_RE = /^([A-G])(bb|b|#|##)?(\d+)$/;

function parsePitch(token: string): Pitch {
  const match = PITCH_RE.exec(token);
  if (!match) throw new Error(`Invalid pitch: "${token}"`);
  const [, step, accidental = "", octave] = match;
  return {
    step: step as Step,
    alter: ALTER_BY_SYMBOL[accidental]!,
    octave: Number(octave),
  };
}

const NOTE_TOKEN_RE = /^([^/]+)\/(\d+)(\.?)$/;

function durationTicksFor(code: string, dotted: boolean): number {
  const base = WHOLE_TICKS / Number(code);
  if (!Number.isInteger(base)) {
    throw new Error(`Invalid duration code: "${code}"`);
  }
  return dotted ? base * 1.5 : base;
}

function parseNoteToken(token: string): {
  pitches: Pitch[];
  durationTicks: number;
} {
  const match = NOTE_TOKEN_RE.exec(token);
  if (!match) throw new Error(`Invalid note token: "${token}"`);
  const [, pitchPart, code, dot] = match;
  const durationTicks = durationTicksFor(code!, dot === ".");
  if (pitchPart === "R") return { pitches: [], durationTicks };
  return { pitches: pitchPart!.split("+").map(parsePitch), durationTicks };
}

function parsePartBody(
  body: string,
  timeSig: TimeSignature,
): { events: NoteEvent[]; measureCount: number } {
  const measureTexts = body
    .split("|")
    .map((measure) => measure.trim())
    .filter((measure) => measure.length > 0);
  const measureTicks = measureLengthTicks(timeSig);
  const events: NoteEvent[] = [];

  measureTexts.forEach((measureText, measureIndex) => {
    const measureStart = measureIndex * measureTicks;
    let cursor = measureStart;
    for (const token of measureText.split(/\s+/)) {
      const { pitches, durationTicks } = parseNoteToken(token);
      if (pitches.length > 0) {
        events.push({
          id: crypto.randomUUID(),
          tick: cursor,
          durationTicks,
          pitches,
        });
      }
      cursor += durationTicks;
    }
    if (cursor - measureStart !== measureTicks) {
      throw new Error(
        `Measure ${measureIndex + 1} totals ${cursor - measureStart} ticks, expected ${measureTicks}`,
      );
    }
  });

  return { events, measureCount: measureTexts.length };
}

function parseSimpleFormat(text: string): ParsedFile {
  let title: string | undefined;
  let composer: string | undefined;
  let tempo: number | undefined;
  let timeSig: TimeSignature = { beats: 4, beatType: 4 };
  let keyFifths = 0;

  const parts: ParsedPart[] = [];
  let currentName: string | null = null;
  let currentClef: Clef = "treble";
  let currentBody = "";

  function flushPart(): void {
    if (currentName === null) return;
    const { events, measureCount } = parsePartBody(currentBody, timeSig);
    parts.push({ name: currentName, clef: currentClef, events, measureCount });
    currentBody = "";
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;

    const directive = /^([a-zA-Z]+):\s*(.*)$/.exec(line);
    if (!directive) {
      if (currentName === null) {
        throw new Error(`Note tokens outside of a "part:" block: "${line}"`);
      }
      currentBody += ` ${line}`;
      continue;
    }

    const [, key, value] = directive;
    switch (key!.toLowerCase()) {
      case "title":
        title = value;
        break;
      case "composer":
        composer = value;
        break;
      case "tempo":
        tempo = Number(value);
        break;
      case "time":
        timeSig = parseTimeSig(value!);
        break;
      case "key":
        keyFifths = Number(value);
        break;
      case "clef":
        if (!isClef(value!)) throw new Error(`Unknown clef: "${value}"`);
        currentClef = value;
        break;
      case "part":
        flushPart();
        currentName = value!;
        currentClef = "treble";
        break;
      default:
        throw new Error(`Unknown directive: "${key}"`);
    }
  }
  flushPart();

  if (parts.length === 0) throw new Error("No parts found in input");
  const measureCount = parts[0]!.measureCount;
  for (const part of parts) {
    if (part.measureCount !== measureCount) {
      throw new Error(
        `Part "${part.name}" has ${part.measureCount} measures, expected ${measureCount} (from "${parts[0]!.name}")`,
      );
    }
  }

  return { title, composer, tempo, timeSig, keyFifths, parts };
}

function buildScore(parsed: ParsedFile): Score {
  const measureCount = parsed.parts[0]!.measureCount;
  const measureTicks = measureLengthTicks(parsed.timeSig);
  const parts: Part[] = parsed.parts.map((p) => ({
    id: crypto.randomUUID(),
    name: p.name,
    events: p.events,
  }));

  return {
    schemaVersion: 1,
    title: parsed.title ?? "Untitled",
    ...(parsed.composer ? { composer: parsed.composer } : {}),
    divisions: DIVISIONS,
    parts,
    measures: Array.from({ length: measureCount }, (_, index) => ({
      index,
      startTick: index * measureTicks,
      timeSig: parsed.timeSig,
      keyFifths: parsed.keyFifths,
    })),
    tempoMap: [{ tick: 0, bpm: parsed.tempo ?? 96 }],
    layout: {
      staves: parsed.parts.map((p, i) => ({
        clef: p.clef,
        partIds: [parts[i]!.id],
      })),
    },
    lyricDisplay: { kind: "perPart" },
  };
}

// Replaces a same-named part in place (keeping its id, so an unrelated
// stave assignment isn't orphaned); otherwise appends it as a new part
// with a fresh stave.
function mergeParts(existing: Score, parsed: ParsedFile): Score {
  for (const part of parsed.parts) {
    if (part.measureCount !== existing.measures.length) {
      throw new Error(
        `Part "${part.name}" has ${part.measureCount} measures, but the existing file has ${existing.measures.length}`,
      );
    }

    const existingIndex = existing.parts.findIndex((p) => p.name === part.name);
    if (existingIndex === -1) {
      const id = crypto.randomUUID();
      existing.parts.push({ id, name: part.name, events: part.events });
      existing.layout.staves.push({ clef: part.clef, partIds: [id] });
      continue;
    }

    const id = existing.parts[existingIndex]!.id;
    existing.parts[existingIndex] = {
      id,
      name: part.name,
      events: part.events,
    };
    const stave = existing.layout.staves.find((s) => s.partIds.includes(id));
    if (stave) stave.clef = part.clef;
  }
  return existing;
}

function usage(): never {
  console.error(
    [
      "Usage:",
      "  npm run xml:build -- <input.txt> <output.musicxml>",
      "  npm run xml:build -- <input.txt> --insert <existing.musicxml> [--out <output.musicxml>]",
    ].join("\n"),
  );
  process.exit(1);
}

function main(): void {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  if (!inputPath) usage();

  const parsed = parseSimpleFormat(readFileSync(inputPath, "utf8"));

  const insertIndex = args.indexOf("--insert");
  if (insertIndex === -1) {
    const outputPath = args[1];
    if (!outputPath) usage();
    writeFileSync(outputPath, scoreToMusicXml(buildScore(parsed)));
    console.log(`Wrote ${outputPath}`);
    return;
  }

  const existingPath = args[insertIndex + 1];
  if (!existingPath) usage();
  const outIndex = args.indexOf("--out");
  const outputPath = outIndex === -1 ? existingPath : args[outIndex + 1];
  if (!outputPath) usage();

  const existing = musicXmlToScore(readFileSync(existingPath, "utf8"));
  writeFileSync(outputPath, scoreToMusicXml(mergeParts(existing, parsed)));
  console.log(`Wrote ${outputPath}`);
}

main();
