/**
 * Downloads `blob` as `filename` via a throwaway object URL and anchor
 * click — shared by every export format (JSON, MusicXML, and eventually
 * PDF) so there's one place that knows how to trigger a browser download.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
