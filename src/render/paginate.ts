import type { Score } from "../model/score.ts";

// One page's layout: which measure indices land in each of its systems,
// top to bottom.
export type PageLayout = { systems: number[][] };

export type PaginationOptions = {
  measureWidth: number;
  systemWidth: number; // Usable width per system (page width minus margins).
  systemHeight: number; // Vertical space one system needs, gap included.
  pageHeight: number; // Usable height per page.
};

/**
 * Groups a score's measures into systems that fit `systemWidth`, then
 * groups those systems into pages that fit `pageHeight` — pure layout
 * planning, no VexFlow or DOM. An empty score still gets one (empty) page,
 * so there's always something to render.
 */
export function paginate(
  score: Score,
  options: PaginationOptions,
): PageLayout[] {
  const measuresPerSystem = Math.max(
    1,
    Math.floor(options.systemWidth / options.measureWidth),
  );
  const systemsPerPage = Math.max(
    1,
    Math.floor(options.pageHeight / options.systemHeight),
  );

  const systems: number[][] = [];
  for (let i = 0; i < score.measures.length; i += measuresPerSystem) {
    systems.push(
      score.measures.slice(i, i + measuresPerSystem).map((m) => m.index),
    );
  }

  const pages: PageLayout[] = [];
  for (let i = 0; i < systems.length; i += systemsPerPage) {
    pages.push({ systems: systems.slice(i, i + systemsPerPage) });
  }
  return pages.length > 0 ? pages : [{ systems: [] }];
}
