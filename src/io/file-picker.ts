/**
 * Opens the browser's file picker restricted to `accept`, parses the
 * chosen file's text with `parse`, and calls `onLoad` with the result.
 * Silently does nothing if the user cancels — there's no reliable
 * cross-browser cancel event on a file input, so there's nothing to clean
 * up either way. `onError` gets whatever `parse` throws for a malformed
 * file. Shared by every import format (JSON, MusicXML) so there's one
 * place that knows how to trigger a browser file pick.
 */
export function pickFile<T>(
  accept: string,
  parse: (text: string) => T,
  onLoad: (value: T) => void,
  onError: (error: unknown) => void = console.error,
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => onLoad(parse(text)))
      .catch(onError);
  });
  input.click();
}
