import type { ReactNode } from "react";

// Inline line icons: no icon package, and they inherit the text colour. Decorative only: every
// use has a visible label or an aria-label on its button.

function Icon({ size = 22, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

export type IconProps = { size?: number };

export function MapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Icon>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2H9zM9 12h6M9 16h4" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 5a3.5 3.5 0 0 1 0 6.5M18 14.5c1.8.8 3 2.9 3 5.5" />
    </Icon>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </Icon>
  );
}

export function SoundOnIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
    </Icon>
  );
}

export function SoundOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5zM16 9.5l5 5M21 9.5l-5 5" />
    </Icon>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9" />
    </Icon>
  );
}

export function ChevronIcon({ size, open }: IconProps & { open: boolean }) {
  return (
    <Icon size={size}>
      <path d={open ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"} />
    </Icon>
  );
}

export function DirectionsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2.5 21.5 12 12 21.5 2.5 12zM9 14v-2a1.5 1.5 0 0 1 1.5-1.5H15M13 8.5l2 2-2 2" />
    </Icon>
  );
}
