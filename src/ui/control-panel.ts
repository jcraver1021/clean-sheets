export type ControlPanel = { layoutToggle: HTMLButtonElement };

/**
 * Builds the toolbar's controls into `mountPoint` and returns references to
 * them, so callers wire listeners without re-querying the DOM.
 */
export function createControlPanel(mountPoint: HTMLElement): ControlPanel {
  const layoutToggle = document.createElement("button");
  layoutToggle.type = "button";
  layoutToggle.textContent = "Toggle layout";
  mountPoint.append(layoutToggle);

  return { layoutToggle };
}
