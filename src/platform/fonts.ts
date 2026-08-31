export type FontReadiness = Pick<FontFaceSet, "ready" | "check">;

/**
 * Waits for `fonts.ready` (or `timeoutMs`, whichever comes first — a font that
 * never loads shouldn't hang the app), then reports which of `fontNames` are
 * actually available via `FontFaceSet.check`. `fonts` defaults to
 * `document.fonts` but is a parameter so this stays testable without a DOM.
 */
export async function waitForFonts(
  fontNames: string[],
  fonts: FontReadiness = document.fonts,
  timeoutMs = 3000,
): Promise<{ ready: boolean; missing: string[] }> {
  await Promise.race([
    fonts.ready,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  const missing = fontNames.filter((name) => !fonts.check(`1em ${name}`));
  return { ready: missing.length === 0, missing };
}
