/**
 * The subset of `FontFaceSet` that `waitForFonts` needs.
 */
export type FontReadiness = Pick<FontFaceSet, "ready" | "check">;

/**
 * Waits for `fonts.ready` or `timeoutMs`, whichever comes first, so that the
 * caller can check for the availability of requested fonts without hanging
 * indefinitely.
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
