import { describe, expect, it } from "vitest";
import type { NoteEvent, Score } from "../model/score.ts";
import { scoreToMusicXml } from "./musicxml-export.ts";

const QUARTER = 960;

function note(
  partial: Partial<NoteEvent> & Pick<NoteEvent, "id" | "tick">,
): NoteEvent {
  return { durationTicks: QUARTER, pitches: [], ...partial };
}

function fixtureScore(): Score {
  return {
    schemaVersion: 1,
    title: "Test & <Title>",
    divisions: QUARTER,
    parts: [
      {
        id: "soprano-uuid",
        name: "Soprano",
        events: [
          note({
            id: "a",
            tick: 0,
            pitches: [{ step: "F", alter: 1, octave: 5 }],
            tie: "start",
          }),
          note({
            id: "b",
            tick: QUARTER,
            pitches: [{ step: "F", alter: 1, octave: 5 }],
            tie: "stop",
          }),
          // A gap here (960..1920 is silent) — should synthesize a rest.
          note({
            id: "c",
            tick: QUARTER * 3,
            pitches: [
              { step: "C", alter: 0, octave: 5 },
              { step: "E", alter: 0, octave: 5 },
            ],
            lyrics: [
              { verse: 1, syllable: "single", text: "Bo" },
              { verse: 2, syllable: "begin", text: "Lo" },
            ],
          }),
        ],
      },
      {
        id: "tenor-uuid",
        name: "Tenor",
        events: [
          note({
            id: "d",
            tick: 0,
            pitches: [{ step: "C", alter: 0, octave: 4 }],
            lyrics: [{ verse: 1, syllable: "begin", text: "Glo" }],
          }),
          note({
            id: "e",
            tick: QUARTER,
            pitches: [{ step: "C", alter: 0, octave: 4 }],
            lyrics: [{ verse: 1, syllable: "middle", text: "" }],
          }),
        ],
      },
    ],
    measures: [
      {
        index: 0,
        startTick: 0,
        timeSig: { beats: 4, beatType: 4 },
        keyFifths: 2,
      },
      {
        index: 1,
        startTick: QUARTER * 4,
        timeSig: { beats: 3, beatType: 4 },
        keyFifths: 2,
      },
    ],
    tempoMap: [{ tick: 0, bpm: 96 }],
    layout: {
      staves: [
        { clef: "treble", partIds: ["soprano-uuid"] },
        { clef: "treble8vb", partIds: ["tenor-uuid"] },
      ],
    },
    lyricDisplay: { kind: "perPart" },
  };
}

describe("scoreToMusicXml", () => {
  const xml = scoreToMusicXml(fixtureScore());

  it("declares the doctype and part list with positional, XML-safe ids", () => {
    expect(xml).toContain("<!DOCTYPE score-partwise");
    expect(xml).toContain(
      '<score-part id="P1"><part-name>Soprano</part-name></score-part>',
    );
    expect(xml).toContain(
      '<score-part id="P2"><part-name>Tenor</part-name></score-part>',
    );
    expect(xml).toContain('<part id="P1">');
    expect(xml).toContain('<part id="P2">');
  });

  it("escapes special characters in text content", () => {
    expect(xml).toContain("<work-title>Test &amp; &lt;Title&gt;</work-title>");
  });

  it("emits divisions, key, and time only in measure 1", () => {
    expect(xml).toContain("<divisions>960</divisions>");
    const firstMeasure = xml
      .split('<measure number="1">')[1]!
      .split("</measure>")[0]!;
    expect(firstMeasure).toContain("<key><fifths>2</fifths></key>");
    expect(firstMeasure).toContain(
      "<time><beats>4</beats><beat-type>4</beat-type></time>",
    );
  });

  it("re-emits attributes only when key or time actually changes", () => {
    const secondMeasure = xml
      .split('<measure number="2">')[1]!
      .split("</measure>")[0]!;
    // Time changes (4/4 -> 3/4) so attributes appear, but key (unchanged) still
    // has to be re-stated alongside it — MusicXML's <attributes> is all-or-nothing.
    expect(secondMeasure).toContain(
      "<time><beats>3</beats><beat-type>4</beat-type></time>",
    );
    // No divisions or clef restated after measure 1.
    expect(secondMeasure).not.toContain("<divisions>");
    expect(secondMeasure).not.toContain("<clef>");
  });

  it("writes a plain treble clef and a tenor treble8vb with clef-octave-change", () => {
    expect(xml).toContain("<clef><sign>G</sign><line>2</line></clef>");
    expect(xml).toContain(
      "<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>",
    );
  });

  it("writes sounding pitch directly, sharps included", () => {
    expect(xml).toContain(
      "<pitch><step>F</step><alter>1</alter><octave>5</octave></pitch>",
    );
  });

  it("fills a silent gap with an explicit rest", () => {
    expect(xml).toContain(
      "<rest/><duration>960</duration><type>quarter</type>",
    );
  });

  it("marks every note past the first in a chord with <chord/>", () => {
    expect(xml).toContain(
      "<pitch><step>C</step><octave>5</octave></pitch><duration>960</duration>",
    );
    expect(xml).toContain(
      "<chord/><pitch><step>E</step><octave>5</octave></pitch>",
    );
  });

  it("emits both a <tie> (duration) and a <notations><tied> (visual) pair", () => {
    expect(xml).toContain('<tie type="start"/>');
    expect(xml).toContain('<tie type="stop"/>');
    expect(xml).toContain('<notations><tied type="start"/></notations>');
    expect(xml).toContain('<notations><tied type="stop"/></notations>');
  });

  it("emits one <lyric> per verse, syllabic mapped straight from Syllable", () => {
    expect(xml).toContain(
      '<lyric number="1"><syllabic>single</syllabic><text>Bo</text></lyric>',
    );
    expect(xml).toContain(
      '<lyric number="2"><syllabic>begin</syllabic><text>Lo</text></lyric>',
    );
  });

  it("puts lyrics only on a chord's first note, not every pitch in it", () => {
    const chordNotes = xml.split("<chord/>");
    expect(chordNotes[0]).toContain("<lyric");
    // Everything from here to the next </note> is the chord's second note.
    expect(chordNotes[1]!.split("</note>")[0]).not.toContain("<lyric");
  });

  it("represents a melisma's held note as an empty-text <extend/>", () => {
    expect(xml).toContain(
      '<lyric number="1"><syllabic>begin</syllabic><text>Glo</text></lyric>',
    );
    expect(xml).toContain('<lyric number="1"><extend/></lyric>');
  });
});
