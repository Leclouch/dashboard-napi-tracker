import { glyphAttrs } from "@/lib/glyph";
import type { DisplayStatus } from "@/lib/status";

/** Status shape. Decorative: the label next to it carries the meaning for screen readers. */
export default function StatusGlyph({ status, size = 18 }: { status: DisplayStatus; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="shrink-0">
      <path {...glyphAttrs(status)} />
    </svg>
  );
}
