import { describe, expect, it, vi } from "vitest";
import { waitForFonts, type FontReadiness } from "./fonts.ts";

function fakeFonts(options: {
  ready: Promise<FontFaceSet | void>;
  available: string[];
}): FontReadiness {
  return {
    // `ready` only needs to resolve/hang for these tests and does not need to
    // resolve to a real `FontFaceSet`.
    ready: options.ready as Promise<FontFaceSet>,
    check: (font: string) =>
      options.available.some((name) => font.includes(name)),
  };
}

describe("waitForFonts", () => {
  it("reports ready when every requested font is available", async () => {
    const fonts = fakeFonts({
      ready: Promise.resolve(),
      available: ["Bravura", "Academico"],
    });
    const result = await waitForFonts(["Bravura"], fonts);
    expect(result).toEqual({ ready: true, missing: [] });
  });

  it("reports the specific fonts that never became available", async () => {
    const fonts = fakeFonts({
      ready: Promise.resolve(),
      available: ["Academico"],
    });
    const result = await waitForFonts(["Bravura", "Academico"], fonts);
    expect(result).toEqual({ ready: false, missing: ["Bravura"] });
  });

  it("falls through on timeout rather than hanging when fonts.ready never resolves", async () => {
    vi.useFakeTimers();
    try {
      const fonts = fakeFonts({
        ready: new Promise(() => {}),
        available: ["Bravura"],
      });
      const pending = waitForFonts(["Bravura"], fonts, 3000);
      await vi.advanceTimersByTimeAsync(3000);
      await expect(pending).resolves.toEqual({ ready: true, missing: [] });
    } finally {
      vi.useRealTimers();
    }
  });
});
