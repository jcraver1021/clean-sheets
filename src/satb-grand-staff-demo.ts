// Stage 0 sketch: a hardcoded 2-measure SATB grand staff, no model layer yet.
// Confirms VexFlow 5's camelCase option naming (numBeats/beatValue/stemDirection)
// and hymnal stem-direction convention (S up / A down on treble, T up / B down on bass).
import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Stem,
  Voice,
} from "vexflow";

export function renderSatbGrandStaffDemo(container: HTMLDivElement) {
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(900, 260);
  const ctx = renderer.getContext();

  const measureWidth = 380;
  const staveX = [10, 10 + measureWidth];
  const trebleY = 20;
  const bassY = 130;

  for (let m = 0; m < 2; m++) {
    const trebleStave = new Stave(staveX[m], trebleY, measureWidth);
    const bassStave = new Stave(staveX[m], bassY, measureWidth);
    if (m === 0) {
      trebleStave.addClef("treble").addTimeSignature("4/4");
      bassStave.addClef("bass").addTimeSignature("4/4");
    }
    trebleStave.setContext(ctx).draw();
    bassStave.setContext(ctx).draw();

    const soprano = [
      new StaveNote({ keys: ["c/5"], duration: "q", stemDirection: Stem.UP }),
      new StaveNote({ keys: ["d/5"], duration: "q", stemDirection: Stem.UP }),
      new StaveNote({ keys: ["e/5"], duration: "q", stemDirection: Stem.UP }),
      new StaveNote({ keys: ["c/5"], duration: "q", stemDirection: Stem.UP }),
    ];
    const alto = [
      new StaveNote({ keys: ["g/4"], duration: "q", stemDirection: Stem.DOWN }),
      new StaveNote({ keys: ["f/4"], duration: "q", stemDirection: Stem.DOWN }),
      new StaveNote({ keys: ["e/4"], duration: "q", stemDirection: Stem.DOWN }),
      new StaveNote({ keys: ["g/4"], duration: "q", stemDirection: Stem.DOWN }),
    ];
    const tenor = [
      new StaveNote({
        keys: ["c/4"],
        duration: "q",
        stemDirection: Stem.UP,
        clef: "bass",
      }),
      new StaveNote({
        keys: ["b/3"],
        duration: "q",
        stemDirection: Stem.UP,
        clef: "bass",
      }),
      new StaveNote({
        keys: ["c/4"],
        duration: "q",
        stemDirection: Stem.UP,
        clef: "bass",
      }),
      new StaveNote({
        keys: ["c/4"],
        duration: "q",
        stemDirection: Stem.UP,
        clef: "bass",
      }),
    ];
    const bass = [
      new StaveNote({
        keys: ["e/3"],
        duration: "q",
        stemDirection: Stem.DOWN,
        clef: "bass",
      }),
      new StaveNote({
        keys: ["d/3"],
        duration: "q",
        stemDirection: Stem.DOWN,
        clef: "bass",
      }),
      new StaveNote({
        keys: ["c/3"],
        duration: "q",
        stemDirection: Stem.DOWN,
        clef: "bass",
      }),
      new StaveNote({
        keys: ["c/3"],
        duration: "q",
        stemDirection: Stem.DOWN,
        clef: "bass",
      }),
    ];

    const voiceTime = { numBeats: 4, beatValue: 4 };
    const trebleVoices = [soprano, alto].map((notes) =>
      new Voice(voiceTime).setStrict(false).addTickables(notes),
    );
    const bassVoices = [tenor, bass].map((notes) =>
      new Voice(voiceTime).setStrict(false).addTickables(notes),
    );

    Accidental.applyAccidentals(trebleVoices, "C");
    Accidental.applyAccidentals(bassVoices, "C");

    new Formatter()
      .joinVoices(trebleVoices)
      .format(trebleVoices, measureWidth - 60);
    new Formatter()
      .joinVoices(bassVoices)
      .format(bassVoices, measureWidth - 60);

    trebleVoices.forEach((v) => v.draw(ctx, trebleStave));
    bassVoices.forEach((v) => v.draw(ctx, bassStave));
  }
}
