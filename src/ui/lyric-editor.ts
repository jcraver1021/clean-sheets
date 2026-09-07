import type { Syllable } from "../model/score.ts";

export type LyricEditorResult = { text: string; syllable: Syllable };

const SYLLABLE_OPTIONS: Syllable[] = ["single", "begin", "middle", "end"];

/**
 * Opens an inline text+syllable-type editor at (x, y) inside `container`,
 * prefilled with `initial`. Enter or losing focus commits via `onSubmit`;
 * Escape cancels via `onCancel`. The syllable type is a plain dropdown
 * rather than inferred from the text (e.g. a trailing hyphen), matching the
 * model's own preference for explicit state over guessed heuristics
 * (`model/lyrics.ts`'s empty-text melisma marker is the same idea).
 */
export function openLyricEditor(
  container: HTMLElement,
  x: number,
  y: number,
  initial: LyricEditorResult,
  onSubmit: (result: LyricEditorResult) => void,
  onCancel: () => void,
): void {
  const form = document.createElement("form");
  form.className = "lyric-editor";
  form.style.left = `${x}px`;
  form.style.top = `${y}px`;

  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.value = initial.text;
  textInput.size = 8;
  form.append(textInput);

  const syllableSelect = document.createElement("select");
  for (const option of SYLLABLE_OPTIONS) {
    const optionEl = document.createElement("option");
    optionEl.value = option;
    optionEl.textContent = option;
    optionEl.selected = option === initial.syllable;
    syllableSelect.append(optionEl);
  }
  form.append(syllableSelect);

  // Both Enter (submit) and clicking away (blur) should commit exactly
  // once; whichever happens first wins and the other becomes a no-op.
  let settled = false;
  function commit(): void {
    if (settled) return;
    settled = true;
    form.remove();
    onSubmit({
      text: textInput.value,
      syllable: syllableSelect.value as Syllable,
    });
  }
  function cancel(): void {
    if (settled) return;
    settled = true;
    form.remove();
    onCancel();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    commit();
  });
  form.addEventListener("keydown", (event) => {
    if (event.key === "Escape") cancel();
  });
  textInput.addEventListener("blur", () => {
    // Defer so a click on the <select> (which also blurs the text input)
    // has a chance to move focus there first, rather than committing early.
    setTimeout(() => {
      if (!form.contains(document.activeElement)) commit();
    }, 0);
  });

  container.append(form);
  textInput.focus();
  textInput.select();
}
