import "./style.css";
import { audition } from "./audio/audition.ts";
import { initVoices, setMuted, setSolo } from "./audio/engine.ts";
import { isPlaying, playFrom, playheadTick, stop } from "./audio/playback.ts";
import { createDemoScore } from "./demo-score.ts";
import {
  deleteEventAt,
  deleteLyric,
  insertNote,
  setLyric,
} from "./edit/commands.ts";
import {
  commit,
  getRevision,
  getScore,
  initHistory,
  redo,
  undo,
} from "./edit/history.ts";
import {
  getActiveDurationTicks,
  getActiveVerse,
  getCursorTick,
  resolveAlter,
  setAccidentalOverride,
  setActiveDurationTicks,
  setActiveVerse,
  setCursorTick,
} from "./edit/tools.ts";
import { fromDiatonic } from "./model/pitch.ts";
import { eventAt } from "./model/query.ts";
import { waitForFonts } from "./platform/fonts.ts";
import { attachGhostNote, attachPlayhead } from "./render/cursor.ts";
import { hitTest } from "./render/hit-test.ts";
import type { LayoutIndex } from "./render/layout-index.ts";
import { attachLyricHighlight } from "./render/lyrics.ts";
import { renderScore } from "./render/renderer.ts";
import { createControlPanel } from "./ui/control-panel.ts";
import { openLyricEditor } from "./ui/lyric-editor.ts";

// VexFlow's SMuFL glyphs are <text> in the Bravura web font, loaded async
// without being awaited on import — drawing before it's ready misaligns
// stems/ledger lines until the next repaint.
const { ready, missing } = await waitForFonts(["Bravura"]);
if (!ready) {
  console.warn(`Fonts not ready before first render: ${missing.join(", ")}`);
}

const container = document.querySelector<HTMLDivElement>("#score")!;
const controlsMount = document.querySelector<HTMLDivElement>("#controls")!;

let layoutIndex: LayoutIndex = { staves: [] };
function rerender(): void {
  layoutIndex = renderScore(container, getScore());
}

initHistory(createDemoScore(), rerender);
initVoices(getScore().parts.map((part) => part.id));

createControlPanel(
  controlsMount,
  getScore().parts.map((part) => ({ id: part.id, name: part.name })),
  {
    onDurationChange: setActiveDurationTicks,
    onAccidentalChange: setAccidentalOverride,
    onUndo: undo,
    onRedo: redo,
    onMuteToggle: setMuted,
    onSoloToggle: setSolo,
    onPlay: () =>
      void playFrom(getScore(), getRevision(), getCursorTick() ?? 0),
    onStop: stop,
    onVerseChange: setActiveVerse,
  },
);

// Returns null if the click missed both the SVG and any hit-testable note
// slot — callers bail out in that case.
function hitFromMouseEvent(
  event: MouseEvent,
): { partId: string; tick: number; diatonic: number } | null {
  const svg = container.querySelector("svg");
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = hitTest(x, y, layoutIndex, getActiveDurationTicks());
  if (!hit) return null;

  // One stave per part now that hymnal mode is gone, so which line the
  // click landed on IS the part it targets — no separate part selector.
  const partId = hit.box.partIds[0];
  if (!partId) return null;
  return { partId, tick: hit.tick, diatonic: hit.diatonic };
}

// Opens the lyric editor for the existing note at (partId, tick), if any —
// never creates a note, so it's safe to trigger from a modifier-click
// without an ordinary click's insert firing first and clobbering it.
function openLyricEditorForNote(
  partId: string,
  tick: number,
  mouseEvent: MouseEvent,
): void {
  const existingEvent = eventAt(getScore(), partId, tick);
  const svg = container.querySelector("svg");
  if (!existingEvent || !svg) return;

  const rect = svg.getBoundingClientRect();
  const x = mouseEvent.clientX - rect.left;
  const y = mouseEvent.clientY - rect.top;
  const verse = getActiveVerse();
  const eventId = existingEvent.id;
  const existingLyric = existingEvent.lyrics?.find(
    (lyric) => lyric.verse === verse,
  );

  openLyricEditor(
    container,
    x,
    y,
    {
      text: existingLyric?.text ?? "",
      syllable: existingLyric?.syllable ?? "single",
    },
    (result) => {
      // Blank text only means something for middle/end (a melisma's held
      // notes, model/lyrics.ts) — for single/begin it means "nothing to
      // show here," so that clears the entry instead of storing an empty one.
      if (
        result.text === "" &&
        (result.syllable === "single" || result.syllable === "begin")
      ) {
        commit((score) => deleteLyric(score, partId, eventId, verse));
      } else {
        commit((score) =>
          setLyric(score, partId, eventId, verse, result.syllable, result.text),
        );
      }
    },
    () => {},
  );
}

// Left click inserts, right click deletes — no separate mode toggle.
// Alt+left click instead moves the playback cursor, and shift+left click
// edits the lyric on whatever note is already there; neither touches notes.
container.addEventListener("click", (event) => {
  const hit = hitFromMouseEvent(event);
  if (!hit) return;

  if (event.altKey) {
    setCursorTick(hit.tick);
    return;
  }
  if (event.shiftKey) {
    openLyricEditorForNote(hit.partId, hit.tick, event);
    return;
  }

  const { step, octave } = fromDiatonic(hit.diatonic);
  commit((score) => {
    const alter = resolveAlter(score, hit.tick, step);
    insertNote(score, hit.partId, hit.tick, getActiveDurationTicks(), [
      { step, octave, alter },
    ]);
  });
});

container.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const hit = hitFromMouseEvent(event);
  if (!hit) return;

  commit((score) => deleteEventAt(score, hit.partId, hit.tick));
});

// Middle click auditions (Mode B) rather than editing: hear what's sounding
// at that beat without touching the score. Shift rolls the chord bottom-up
// (voice leading) instead of playing it as a block.
container.addEventListener("mousedown", (event) => {
  if (event.button !== 1) return;
  event.preventDefault();
  const hit = hitFromMouseEvent(event);
  if (!hit) return;

  void audition(
    getScore(),
    getRevision(),
    hit.tick,
    event.shiftKey ? "roll" : "block",
  );
});

attachGhostNote(container, () => layoutIndex, getActiveDurationTicks);
function displayTick(): number | null {
  return isPlaying() ? playheadTick(getScore()) : getCursorTick();
}
attachPlayhead(container, () => layoutIndex, displayTick);
attachLyricHighlight(container, getScore, displayTick);
