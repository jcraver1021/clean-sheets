import { Element } from "vexflow";
import type { RenderContext } from "vexflow";

/**
 * VexFlow measures every glyph via a real <canvas> 2D context
 * (Element.measureText); a fake one just needs consistent non-zero widths so
 * relative layout math (does a clef/time signature's width get accounted
 * for?) is still observable without a browser.
 */
export function installFakeTextMeasurementCanvas(): void {
  const context = {
    font: "",
    measureText: (text: string) => ({
      width: text.length * 20,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      fontBoundingBoxAscent: 8,
      fontBoundingBoxDescent: 2,
    }),
  };
  Element.setTextMeasurementCanvas({
    getContext: () => context,
  } as unknown as HTMLCanvasElement);
}

/**
 * A no-op RenderContext: drawStaveRow calls real draw()/format() methods on
 * real VexFlow objects, which need *some* context to draw into, but nothing
 * reads the drawn output in these tests — only the returned geometry does.
 */
export function fakeRenderContext(): RenderContext {
  const chainable = new Proxy(
    {},
    {
      get: (_target, prop) =>
        prop === "measureText" ? () => ({ width: 0 }) : () => chainable,
    },
  );
  return chainable as RenderContext;
}
