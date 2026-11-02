import type { DisplayStatus } from "./status";

// Every status is a circle; colour and animation (globals.css, .status-dot) show the urgency.
// One definition feeds both StatusGlyph and the Leaflet markers, which need an HTML string.

export function statusDotClass(status: DisplayStatus, animated: boolean): string {
  return `status-dot status-dot--${status}${animated ? " is-animated" : ""}`;
}

/** The dot as HTML for Leaflet divIcons. Only ever built from the status constants above. */
export function statusDotHtml(status: DisplayStatus, size: number): string {
  return (
    `<span class="${statusDotClass(status, true)}" style="--dot:${size}px">` +
    `<span class="status-dot__ring"></span><span class="status-dot__core"></span></span>`
  );
}
