"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useShell } from "@/lib/live-context";
import {
  ClipboardIcon,
  ClockIcon,
  LogoutIcon,
  MapIcon,
  PeopleIcon,
  SlidersIcon,
  SoundOffIcon,
  SoundOnIcon,
  type IconProps,
} from "./Icons";

interface NavItem {
  label: string;
  icon: ComponentType<IconProps>;
  /** No href: the page isn't built yet, so it shows as "Segera" and can't be clicked. */
  href?: string;
}

const ITEMS: NavItem[] = [
  { label: "Pemantauan", icon: MapIcon, href: "/" },
  { label: "Penugasan", icon: ClipboardIcon, href: "/penugasan" },
  { label: "Riwayat", icon: ClockIcon },
  { label: "Data master", icon: PeopleIcon },
  { label: "Pengaturan", icon: SlidersIcon },
];

/** Sound state in words: a silent alarm must never look like a working one. */
export function soundLabel(alarm: { muted: boolean; blocked: boolean }): string {
  if (alarm.muted) return "Suara mati";
  return alarm.blocked ? "Klik untuk aktifkan suara" : "Suara nyala";
}

export function SoundButton() {
  const { alarm } = useShell();
  const blocked = !alarm.muted && alarm.blocked;
  const label = soundLabel(alarm);
  return (
    <button
      type="button"
      onClick={alarm.toggle}
      aria-pressed={!alarm.muted}
      aria-label={label}
      title={label}
      className={`flex h-10 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold ${
        blocked ? "bg-warn-tint text-[#7a3a04]" : "text-ink hover:bg-ground"
      }`}
    >
      {alarm.muted ? <SoundOffIcon /> : <SoundOnIcon />}
      {blocked && <span className="whitespace-nowrap">Aktifkan suara</span>}
    </button>
  );
}

export function LogoutButton() {
  const { logout } = useShell();
  return (
    <button
      type="button"
      onClick={logout}
      aria-label="Keluar"
      title="Keluar"
      className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-ground"
    >
      <LogoutIcon />
    </button>
  );
}

/** Floating bar on desktop, bottom tab bar on phones. */
export default function NavBar() {
  const pathname = usePathname();

  return (
    <>
      <nav
        aria-label="Menu utama"
        className="float-surface fixed top-3 left-3 z-[1100] hidden h-14 items-center gap-1 rounded-full px-2 lg:flex"
      >
        <span className="mr-1 hidden pl-3 text-base font-extrabold whitespace-nowrap text-brand xl:block">
          Gelang GPS
        </span>
        {ITEMS.map(({ label, icon: ItemIcon, href }) => {
          const active = href === pathname;
          if (!href) {
            return (
              <span
                key={label}
                aria-disabled="true"
                title={`${label} (segera)`}
                className="flex flex-col items-center px-2 leading-tight whitespace-nowrap text-[#8a97ab]"
              >
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-[11px]">Segera</span>
              </span>
            );
          }
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap ${
                active ? "bg-brand text-white" : "text-ink hover:bg-ground"
              }`}
            >
              <ItemIcon size={18} />
              {label}
            </Link>
          );
        })}
        <span className="mx-1 h-6 w-px bg-line" />
        <SoundButton />
        <LogoutButton />
      </nav>

      <nav
        aria-label="Menu utama"
        className="fixed inset-x-0 bottom-0 z-[1200] grid h-16 grid-cols-5 border-t border-line bg-white lg:hidden"
      >
        {ITEMS.map(({ label, icon: ItemIcon, href }) => {
          const active = href === pathname;
          const short = label === "Data master" ? "Data" : label;
          if (!href) {
            return (
              <span
                key={label}
                aria-disabled="true"
                className="flex flex-col items-center justify-center leading-tight text-[#8a97ab]"
              >
                <ItemIcon size={20} />
                <span className="text-[11px] font-semibold">{short}</span>
                <span className="text-[10px]">Segera</span>
              </span>
            );
          }
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                active ? "text-brand" : "text-ink-soft"
              }`}
            >
              <ItemIcon size={22} />
              {short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
