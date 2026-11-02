import type { CSSProperties } from "react";
import { statusDotClass } from "@/lib/glyph";
import type { DisplayStatus } from "@/lib/status";

interface Props {
  status: DisplayStatus;
  size?: number;
  /** Off by default: only the map and alert cards move, so the screen doesn't flicker everywhere. */
  animated?: boolean;
}

/** Status dot. Decorative: the label next to it carries the meaning for screen readers. */
export default function StatusGlyph({ status, size = 18, animated = false }: Props) {
  return (
    <span
      aria-hidden="true"
      className={statusDotClass(status, animated)}
      style={{ "--dot": `${size}px` } as CSSProperties}
    >
      <span className="status-dot__ring" />
      <span className="status-dot__core" />
    </span>
  );
}
