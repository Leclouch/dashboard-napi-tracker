import { STATUS_COLOR } from "./format";
import type { DisplayStatus } from "./status";

// Every status has its own shape, so status never depends on colour alone. One definition feeds
// both the React lists (StatusGlyph) and the Leaflet markers, which need an HTML string.

const CIRCLE = "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z";
const SMALL_CIRCLE = "M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12z";
const DIAMOND = "M12 1.5 22.5 12 12 22.5 1.5 12z";
const TRIANGLE = "M12 2.5 22.5 21H1.5z";

export interface GlyphAttrs {
  d: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

export function glyphAttrs(status: DisplayStatus): GlyphAttrs {
  const color = STATUS_COLOR[status];
  switch (status) {
    case "alert":
      return { d: DIAMOND, fill: color, stroke: "#ffffff", strokeWidth: 1.5 };
    case "warn":
      return { d: TRIANGLE, fill: color, stroke: "#ffffff", strokeWidth: 1.5 };
    case "signal_lost":
      // Hollow and dashed: this is where the bracelet was, not where it is.
      return { d: CIRCLE, fill: "#ffffff", stroke: color, strokeWidth: 3.5, strokeDasharray: "5 3" };
    case "normal":
      return { d: CIRCLE, fill: color, stroke: "#ffffff", strokeWidth: 1.5 };
    case "unassigned":
      return { d: SMALL_CIRCLE, fill: color, stroke: "#ffffff", strokeWidth: 1.5 };
  }
}

/** The same glyph as an SVG string, for Leaflet divIcons. Only ever built from the constants above. */
export function glyphSvg(status: DisplayStatus, size: number): string {
  const { d, fill, stroke, strokeWidth, strokeDasharray } = glyphAttrs(status);
  const dash = strokeDasharray ? ` stroke-dasharray="${strokeDasharray}"` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">` +
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dash}/></svg>`
  );
}
