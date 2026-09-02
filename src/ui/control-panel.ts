import type { AccidentalOverride, EditMode } from "../edit/tools.ts";

export type ControlPanelCallbacks = {
  onDurationChange: (durationTicks: number) => void;
  onAccidentalChange: (override: AccidentalOverride) => void;
  onModeChange: (mode: EditMode) => void;
  onUndo: () => void;
  onRedo: () => void;
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

const MODES: Array<{ label: string; mode: EditMode }> = [
  { label: "Insert", mode: "insert" },
  { label: "Delete", mode: "delete" },
];
const DEFAULT_MODE_INDEX = 0; // Insert, matching edit/tools.ts's default.

/** A mutually-exclusive row of buttons; only one carries the "active" class at a time. */
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
 * Builds the toolbar's controls into `mountPoint` and wires them straight to
 * `callbacks` — main.ts owns what each control does, this just presents them.
 * There's no part selector: with one stave per part, which part an edit
 * targets comes from which line the mouse is on, not a separate control.
 */
export function createControlPanel(
  mountPoint: HTMLElement,
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
  createButtonGroup(
    mountPoint,
    MODES.map((m) => ({ label: m.label, value: m.mode })),
    DEFAULT_MODE_INDEX,
    callbacks.onModeChange,
  );

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

  return { undoButton, redoButton };
}
