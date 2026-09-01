/**
 * A clef name. `treble8vb` (tenor, open-score) is ours, not VexFlow's —
 * written an octave above where it sounds. See `Pitch`.
 */
export type Clef = "treble" | "bass" | "treble8vb";

/**
 * A note letter, no accidental or octave.
 */
export type Step = "C" | "D" | "E" | "F" | "G" | "A" | "B";

/**
 * A diatonic pitch spelling, stored as sounded, not written (see `Clef`).
 * `alter` is semitones raised/lowered by accidental.
 */
export type Pitch = {
  step: Step;
  alter: -2 | -1 | 0 | 1 | 2;
  octave: number; // 4 = the octave containing middle C
};

/**
 * A syllable's position in its word (hyphenation/melisma).
 */
export type Syllable = "single" | "begin" | "middle" | "end";

/**
 * One verse's text for one note. Polysyllabic words span multiple
 * `NoteEvent`s/`Lyric`s.
 */
export type Lyric = {
  verse: number; // 1-indexed stanza number
  syllable: Syllable;
  text: string;
};

/**
 * A tie's relation to its note: `start` ties to the next note, `stop` from the
 * previous, `both` does both (mid-phrase continuation).
 */
export type Tie = "start" | "stop" | "both";

/**
 * A single note, chord, or rest in a part.
 */
export type NoteEvent = {
  id: string;
  tick: number; // Absolute onset tick from score start, not measure-relative.
  durationTicks: number; // Length in ticks, same units as tick.
  pitches: Pitch[]; // Empty = rest; more than one = a chord within this part.
  tie?: Tie;
  lyrics?: Lyric[];
};

/**
 * A single voice. `id` is opaque/stable (what layout, mute/solo, and lyric
 * source point to); `name` is the only user-editable bit — so part count and
 * S/A/T/B labels can change freely.
 */
export type Part = {
  id: string;
  name: string;
  events: NoteEvent[]; // Sorted by tick, non-overlapping.
};

/**
 * A time signature: `beats` per measure of `beatType`-th notes
 * (4/4 = `{beats: 4, beatType: 4}`).
 */
export type TimeSignature = { beats: number; beatType: number };

/**
 * One measure's globals: where it starts, and its time and key signature.
 */
export type MeasureSpec = {
  index: number;
  startTick: number;
  timeSig: TimeSignature;
  keyFifths: number; // -7..7, as in MusicXML.
};

/**
 * A tempo change at `tick`; `bpm` is quarter notes/minute, independent of time
 * signature.
 */
export type TempoPoint = { tick: number; bpm: number };

/**
 * One stave's clef and which parts render on it, top voice first.
 */
export type StaveAssignment = { clef: Clef; partIds: string[] };

/**
 * How parts map to staves: `grandStaff` = hymnal two-stave,
 * `openScore` = one stave per part.
 */
export type LayoutPolicy = {
  kind: "grandStaff" | "openScore";
  staves: StaveAssignment[];
};

/**
 * How lyrics are drawn: `shared` is one line per verse under the system, from
 * `sourcePartId`; `perPart` draws each part's own line, for diverging rhythms.
 */
export type LyricDisplay =
  { kind: "shared"; sourcePartId: string } | { kind: "perPart" };

/**
 * The score document model. Parts are independent of staves; `LayoutPolicy`
 * projects them onto an arrangement, so hymnal/open-score is a one-field
 * switch.
 */
export type Score = {
  schemaVersion: 1; // Bumped when this shape changes, for migrating saved files on load.
  title: string;
  composer?: string;
  divisions: number; // Ticks per quarter note (default 960).
  parts: Part[];
  measures: MeasureSpec[];
  tempoMap: TempoPoint[]; // Non-empty, sorted by tick, and tempoMap[0].tick === 0.
  layout: LayoutPolicy;
  lyricDisplay: LyricDisplay;
};
