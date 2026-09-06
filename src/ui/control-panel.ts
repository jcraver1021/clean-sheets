import type { AccidentalOverride } from "../edit/tools.ts";

export type ControlPanelCallbacks = {
  onDurationChange: (durationTicks: number) => void;
  onAccidentalChange: (override: AccidentalOverride) => void;
  onUndo: () => void;
  onRedo: () => void;
  onMuteToggle: (partId: string, muted: boolean) => void;
  onSoloToggle: (partId: string | null) => void;
  onPlay: () => void;
  onStop: () => void;
};

export type ControlPanel = {
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
};

// Ticks assume divisions=960 (the spec's fixed convention — see model/score.ts).
const DURATIONS: Array<{ label: string; ticks: number }> = [
  { label: "Whole", ticks: 3840 },
  { label: "Half", ticks: 1920 },
  { label: "Quarter", ticks: 960 },
  { label: "Eighth", ticks: 480 },
  { label: "Sixteenth", ticks: 240 },
];
const DEFAULT_DURATION_INDEX = 2; // Quarter, matching edit/tools.ts's default.

const ACCIDENTALS: Array<{ label: string; override: AccidentalOverride }> = [
  { label: "Auto", override: null },
  { label: "bb", override: -2 },
  { label: "b", override: -1 },
  { label: "nat", override: 0 },
  { label: "#", override: 1 },
  { label: "##", override: 2 },
];
const DEFAULT_ACCIDENTAL_INDEX = 0; // Auto, matching edit/tools.ts's default.

/**
 * A mutually-exclusive row of buttons; only one carries the "active"
 * class at a time.
 */
function createButtonGroup<T>(
  mountPoint: HTMLElement,
  items: Array<{ label: string; value: T }>,
  activeIndex: number,
  onSelect: (value: T) => void,
): void {
  const group = document.createElement("span");
  const buttons = items.map((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.classList.toggle("active", index === activeIndex);
    button.addEventListener("click", () => {
      buttons.forEach((sibling) => sibling.classList.remove("active"));
      button.classList.add("active");
      onSelect(item.value);
    });
    group.append(button);
    return button;
  });
  mountPoint.append(group);
}

/**
 * One part's Mute/Solo row. Mute toggles independently per part; Solo is
 * exclusive — soloing one part clears any other, and soloing the currently
 * soloed part clears it back to none, matching `engine.ts`'s single
 * `soloPartId`.
 */
function createMixerRow(
  mountPoint: HTMLElement,
  part: { id: string; name: string },
  soloButtons: HTMLButtonElement[],
  callbacks: Pick<ControlPanelCallbacks, "onMuteToggle" | "onSoloToggle">,
): void {
  const row = document.createElement("span");

  const label = document.createElement("span");
  label.textContent = part.name;
  row.append(label);

  const muteButton = document.createElement("button");
  muteButton.type = "button";
  muteButton.textContent = "Mute";
  muteButton.addEventListener("click", () => {
    callbacks.onMuteToggle(part.id, muteButton.classList.toggle("active"));
  });
  row.append(muteButton);

  const soloButton = document.createElement("button");
  soloButton.type = "button";
  soloButton.textContent = "Solo";
  soloButton.addEventListener("click", () => {
    const willSolo = !soloButton.classList.contains("active");
    soloButtons.forEach((sibling) => sibling.classList.remove("active"));
    soloButton.classList.toggle("active", willSolo);
    callbacks.onSoloToggle(willSolo ? part.id : null);
  });
  soloButtons.push(soloButton);
  row.append(soloButton);

  mountPoint.append(row);
}

/**
 * Builds the toolbar's controls into `mountPoint` and wires them straight to
 * `callbacks` — main.ts owns what each control does, this just presents them.
 * There's no part selector for note entry (which part an edit targets comes
 * from which line the mouse is on) and no insert/delete mode toggle (left
 * click inserts, right click deletes) — but the mixer still needs the part
 * list, since mute/solo apply per part regardless of which line is clicked.
 */
export function createControlPanel(
  mountPoint: HTMLElement,
  parts: Array<{ id: string; name: string }>,
  callbacks: ControlPanelCallbacks,
): ControlPanel {
  createButtonGroup(
    mountPoint,
    DURATIONS.map((d) => ({ label: d.label, value: d.ticks })),
    DEFAULT_DURATION_INDEX,
    callbacks.onDurationChange,
  );
  createButtonGroup(
    mountPoint,
    ACCIDENTALS.map((a) => ({ label: a.label, value: a.override })),
    DEFAULT_ACCIDENTAL_INDEX,
    callbacks.onAccidentalChange,
  );

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.textContent = "Play";
  playButton.addEventListener("click", callbacks.onPlay);
  mountPoint.append(playButton);

  const stopButton = document.createElement("button");
  stopButton.type = "button";
  stopButton.textContent = "Stop";
  stopButton.addEventListener("click", callbacks.onStop);
  mountPoint.append(stopButton);

  const undoButton = document.createElement("button");
  undoButton.type = "button";
  undoButton.textContent = "Undo";
  undoButton.addEventListener("click", callbacks.onUndo);
  mountPoint.append(undoButton);

  const redoButton = document.createElement("button");
  redoButton.type = "button";
  redoButton.textContent = "Redo";
  redoButton.addEventListener("click", callbacks.onRedo);
  mountPoint.append(redoButton);

  const soloButtons: HTMLButtonElement[] = [];
  parts.forEach((part) =>
    createMixerRow(mountPoint, part, soloButtons, callbacks),
  );

  return { undoButton, redoButton };
}
