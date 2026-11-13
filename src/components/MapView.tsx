"use client";

// Leaflet touches `window`, so this file is only loaded in the browser (see AppShell: ssr false).
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { divIcon, latLngBounds, type DivIcon, type LatLngTuple } from "leaflet";
import {
  AttributionControl,
  CircleMarker,
  LayerGroup,
  LayersControl,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { FIX_STATUS_LABEL, EPISODE_LABEL, formatAgo, formatDistance, formatTime } from "@/lib/format";
import { statusDotHtml } from "@/lib/glyph";
import type { DisplayStatus, Selection } from "@/lib/status";
import { runOpacity, spaceDots, trailDots, trailRuns, type TrailDot } from "@/lib/trail";
import type { Assignment, Episode, Fix, FixStatus, TrailPoint, Zone } from "@/lib/types";

/** Placeholder until zones load: around Lapas Cebongan. */
const DEFAULT_CENTER: LatLngTuple = [-7.74, 110.3423];
/** Close enough to tell which side of the fence a bracelet is on. */
const SELECTED_MIN_ZOOM = 18;

/** Same colours as the status dots (globals.css); Leaflet paths need plain values. */
const TRAIL_COLOR: Record<FixStatus, string> = {
  normal: "#15803d",
  warn: "#fbbf24",
  alert: "#b91c1c",
  unassigned: "#6b7280",
};

const STREET = "Peta jalan";
const SATELLITE = "Satelit";
const LAYER_KEY = "gelang.mapLayer";

/** The chosen layer is a per-viewer convenience; losing it only means back to the street map. */
function readLayer(): string {
  try {
    return localStorage.getItem(LAYER_KEY) === SATELLITE ? SATELLITE : STREET;
  } catch {
    return STREET;
  }
}

function writeLayer(name: string): void {
  try {
    localStorage.setItem(LAYER_KEY, name);
  } catch {
    // Not remembered, nothing else depends on it.
  }
}

/**
 * The parts of the map hidden behind floating panels, in pixels. Keep in step with AppShell's
 * panel width and PhoneSheet's half height, so bracelets land in the part staff can see.
 */
function coveredEdges(map: { getSize(): { y: number } }) {
  if (window.matchMedia("(min-width: 1024px)").matches) {
    return { top: 0, right: 392, bottom: 0, left: 0 };
  }
  const sheetHalf = map.getSize().y * 0.42;
  return { top: 136, right: 0, bottom: sheetHalf + 64, left: 0 };
}

/** GeoJSON ring [lng, lat] -> Leaflet [lat, lng]. Never swap these elsewhere. */
function ringToLatLngs(ring: [number, number][]): LatLngTuple[] {
  return ring.map(([lng, lat]) => [lat, lng]);
}

const icons = new Map<string, DivIcon>();

/** Cached: a new icon object makes Leaflet rebuild the marker's DOM on every 5 s tick. */
function statusIcon(status: DisplayStatus, emphasised: boolean, selected: boolean): DivIcon {
  const key = `${status}:${emphasised}:${selected}`;
  let icon = icons.get(key);
  if (!icon) {
    const size = emphasised ? 26 : 20;
    icon = divIcon({
      className: `bracelet-marker${selected ? " is-selected" : ""}`,
      html: statusDotHtml(status, size),
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      tooltipAnchor: [0, -size / 2],
    });
    icons.set(key, icon);
  }
  return icon;
}

/** Zooms to the zones the first time they arrive; after that the user controls the view. */
function FitToZones({ zones }: { zones: Zone[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || zones.length === 0) return;
    const bounds = latLngBounds(zones.flatMap((z) => ringToLatLngs(z.boundary.coordinates[0])));
    const covered = coveredEdges(map);
    map.fitBounds(bounds, {
      paddingTopLeft: [covered.left + 40, covered.top + 40],
      paddingBottomRight: [covered.right + 40, covered.bottom + 40],
      maxZoom: 18,
    });
    done.current = true;
  }, [map, zones]);
  return null;
}

/** Moves the map to a bracelet when it is selected, but doesn't chase it on every new fix. */
function FlyToSelection({ selection, fixes }: { selection: Selection | null; fixes: Fix[] }) {
  const map = useMap();
  const fixesRef = useRef(fixes);
  useEffect(() => {
    fixesRef.current = fixes;
  }, [fixes]);

  useEffect(() => {
    if (!selection) return;
    const fix = fixesRef.current.find((f) => f.braceletId === selection.braceletId);
    if (!fix) return;
    const zoom = Math.max(map.getZoom(), SELECTED_MIN_ZOOM);
    const covered = coveredEdges(map);
    // Aim past the bracelet by half the covered width, so it lands in the middle of what's visible.
    const target = map.unproject(
      map
        .project([fix.lat, fix.lng], zoom)
        .add([(covered.right - covered.left) / 2, (covered.bottom - covered.top) / 2]),
      zoom,
    );
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo(target, zoom, { animate: !reducedMotion, duration: 0.6 });
  }, [map, selection]);
  return null;
}

/**
 * Where the bracelet actually reported from; hover shows when. How many dots show depends on the
 * zoom (see spaceDots). Clicks on a dot don't reach the map, so they don't clear the selection.
 */
function TrailDots({ dots }: { dots: TrailDot[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const shown = useMemo(() => spaceDots(dots, zoom), [dots, zoom]);

  return shown.map((dot) => (
    <CircleMarker
      key={dot.recordedAt}
      center={[dot.lat, dot.lng]}
      radius={4.5}
      pathOptions={{
        color: "#ffffff",
        weight: 1.5,
        fillColor: TRAIL_COLOR[dot.status],
        fillOpacity: runOpacity(dot.age),
        opacity: runOpacity(dot.age),
        bubblingMouseEvents: false,
      }}
    >
      <Tooltip className="bracelet-tooltip" direction="top">
        {formatTime(dot.recordedAt)}
      </Tooltip>
    </CircleMarker>
  ));
}

function MapEvents({ onClear }: { onClear: () => void }) {
  useMapEvents({
    click: onClear,
    baselayerchange: (event) => writeLayer(event.name),
  });
  return null;
}

interface Props {
  zones: Zone[];
  fixes: Fix[];
  openAlerts: Episode[];
  assignments: Assignment[];
  now: number;
  selection: Selection | null;
  /** Path of the selected bracelet, oldest point first; empty when nothing is selected. */
  trail: TrailPoint[];
  onSelect: (braceletId: number) => void;
  onClearSelection: () => void;
}

export default function MapView({
  zones,
  fixes,
  openAlerts,
  assignments,
  now,
  selection,
  trail,
  onSelect,
  onClearSelection,
}: Props) {
  const [initialLayer] = useState(readLayer);
  const runs = useMemo(() => trailRuns(trail), [trail]);
  const dots = useMemo(() => trailDots(trail), [trail]);
  const alertByBracelet = new Map(openAlerts.map((a) => [a.braceletId, a]));
  const assignedBracelets = new Set(assignments.map((a) => a.braceletId));

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={17}
      className="h-full w-full"
      zoomControl={false}
      attributionControl={false}
    >
      <AttributionControl position="bottomleft" />
      <ZoomControl position="bottomleft" />
      <LayersControl position="bottomleft">
        <LayersControl.BaseLayer checked={initialLayer === STREET} name={STREET}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="tile-muted"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked={initialLayer === SATELLITE} name={SATELLITE}>
          <LayerGroup>
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </LayerGroup>
        </LayersControl.BaseLayer>
      </LayersControl>

      <FitToZones zones={zones} />
      <FlyToSelection selection={selection} fixes={fixes} />
      <MapEvents onClear={onClearSelection} />

      {zones.map((zone) => (
        <Polygon
          key={zone.id}
          positions={ringToLatLngs(zone.boundary.coordinates[0])}
          // Neutral on purpose: on the map, blue must not read as a status.
          pathOptions={{ color: "#4a5a75", weight: 2, fillOpacity: 0.07 }}
        >
          <Tooltip sticky className="bracelet-tooltip">
            {zone.name}
          </Tooltip>
        </Polygon>
      ))}

      {/* Not interactive, so a click on the line still reaches the map and clears the selection. */}
      {runs.map((run, i) => (
        <Polyline
          key={i}
          positions={run.positions}
          pathOptions={{
            color: TRAIL_COLOR[run.status],
            weight: 4,
            opacity: runOpacity(run.age),
            lineCap: "round",
            lineJoin: "round",
            interactive: false,
          }}
        />
      ))}
      <TrailDots dots={dots} />

      {fixes.map((fix) => {
        const alert = alertByBracelet.get(fix.braceletId);
        // A bracelet that isn't handed out keeps its last fix, which may date from an old
        // assignment. Showing that fix's status would put a false red marker on the map.
        const fixStatus = assignedBracelets.has(fix.braceletId) ? fix.status : "unassigned";
        const status: DisplayStatus = alert?.type ?? fixStatus;
        const statusText = alert ? EPISODE_LABEL[alert.type] : FIX_STATUS_LABEL[fixStatus];
        const selected = fix.braceletId === selection?.braceletId;
        const distance = fixStatus === "unassigned" ? null : formatDistance(fix.distanceOutsideMeters);
        // Only the selected bracelet keeps its label open: inmates work close together, and
        // permanent labels hide each other and the markers. Inmate names stay in the side panel.
        return (
          <Marker
            key={fix.braceletId}
            position={[fix.lat, fix.lng]}
            icon={statusIcon(status, selected || alert !== undefined, selected)}
            alt={`${fix.deviceLabel}: ${statusText}`}
            zIndexOffset={selected ? 2000 : alert ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(fix.braceletId) }}
          >
            {/* Leaflet reads `permanent` only at creation, so the key forces a new tooltip. */}
            <Tooltip key={String(selected)} className="bracelet-tooltip" direction="top" permanent={selected}>
              <div className="font-semibold">{fix.deviceLabel}</div>
              <div>{statusText}</div>
              {status !== "signal_lost" && distance && <div>{distance}</div>}
              <div className="text-ink-soft">
                {status === "signal_lost" ? "Posisi terakhir " : ""}
                {formatAgo(fix.recordedAt, now)}
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
