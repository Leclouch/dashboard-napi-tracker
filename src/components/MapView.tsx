"use client";

// Leaflet touches `window`, so this file is only loaded in the browser (see AppShell: ssr false).
import "leaflet/dist/leaflet.css";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
import {
  addCorner,
  corner,
  MIN_CORNERS,
  moveCorner,
  removeCorner,
  type Corner,
  type ZoneDraft,
} from "@/lib/zone-draft";

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

/**
 * The zone outline. Not a status colour (green, amber, red, grey), not blue (blue isn't a status
 * either, see CLAUDE.md), and not grey or green, which vanish into satellite terrain. Violet is
 * rare in imagery and unlike every status.
 */
const ZONE_COLOR = "#c026d3";

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
function coveredEdges(map: { getSize(): { y: number } }, sheetClosed: boolean) {
  if (window.matchMedia("(min-width: 1024px)").matches) {
    return { top: 0, right: 392, bottom: 0, left: 0 };
  }
  // With the sheet closed only its docked handle (36 px) and the tab bar cover the bottom.
  const sheetHalf = sheetClosed ? 36 : map.getSize().y * 0.42;
  return { top: 136, right: 0, bottom: sheetHalf + 64, left: 0 };
}

/** GeoJSON ring [lng, lat] -> Leaflet [lat, lng]. Never swap these elsewhere. */
function ringToLatLngs(ring: [number, number][]): LatLngTuple[] {
  return ring.map(([lng, lat]) => [lat, lng]);
}

/** Leaflet [lat, lng] -> a GeoJSON corner [lng, lat]. The only other place the order flips. */
function latLngToCorner({ lat, lng }: { lat: number; lng: number }): Corner {
  return corner(lng, lat);
}

/**
 * The map hidden behind a page's sheet while a zone is drawn. On a desktop the sheet is a panel
 * at the left (PageSheet: min(46rem, 100vw - 23rem - 2.25rem) plus its 12 px margin).
 */
function pageCoveredEdges(map: { getSize(): { y: number } }, sheetClosed: boolean) {
  if (window.matchMedia("(min-width: 1024px)").matches) {
    const sheet = Math.min(736, window.innerWidth - 368 - 36);
    return { top: 80, right: 392, bottom: 0, left: sheet + 12 };
  }
  return coveredEdges(map, sheetClosed);
}

/** A corner of the zone being drawn: a small square, unlike the round status dots. */
const cornerIcon = divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:4px;background:#fff;border:3px solid ${ZONE_COLOR};box-shadow:0 1px 3px rgb(0 0 0/.4);cursor:move"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

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
function FitToZones({ zones, sheetClosed }: { zones: Zone[]; sheetClosed: boolean }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || zones.length === 0) return;
    const bounds = latLngBounds(zones.flatMap((z) => ringToLatLngs(z.boundary.coordinates[0])));
    const covered = coveredEdges(map, sheetClosed);
    map.fitBounds(bounds, {
      paddingTopLeft: [covered.left + 40, covered.top + 40],
      paddingBottomRight: [covered.right + 40, covered.bottom + 40],
      maxZoom: 18,
    });
    done.current = true;
  }, [map, zones, sheetClosed]);
  return null;
}

/** Moves the map to a bracelet when it is selected, but doesn't chase it on every new fix. */
function FlyToSelection({
  selection,
  fixes,
  sheetClosed,
}: {
  selection: Selection | null;
  fixes: Fix[];
  sheetClosed: boolean;
}) {
  const map = useMap();
  const fixesRef = useRef(fixes);
  // Read when a bracelet is selected; opening or closing the sheet alone must not move the map.
  const sheetClosedRef = useRef(sheetClosed);
  useEffect(() => {
    fixesRef.current = fixes;
    sheetClosedRef.current = sheetClosed;
  }, [fixes, sheetClosed]);

  useEffect(() => {
    if (!selection) return;
    const fix = fixesRef.current.find((f) => f.braceletId === selection.braceletId);
    if (!fix) return;
    const zoom = Math.max(map.getZoom(), SELECTED_MIN_ZOOM);
    const covered = coveredEdges(map, sheetClosedRef.current);
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

function MapEvents({ onClick }: { onClick: (at: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click: (event) => onClick(event.latlng),
    baselayerchange: (event) => writeLayer(event.name),
  });
  return null;
}

/**
 * Shows the whole zone when its editing starts (or a new one is begun with corners), so the
 * superadmin doesn't have to look for it. After that the view is theirs again.
 */
function FitToDraft({ draft, sheetClosed }: { draft: ZoneDraft | null; sheetClosed: boolean }) {
  const map = useMap();
  const fittedFor = useRef<number | "new" | null>(null);
  const editing = draft === null ? null : (draft.zoneId ?? "new");
  const corners = draft?.corners;

  useEffect(() => {
    if (editing === null) {
      fittedFor.current = null;
      return;
    }
    if (fittedFor.current === editing || !corners || corners.length < MIN_CORNERS) return;
    fittedFor.current = editing;
    const covered = pageCoveredEdges(map, sheetClosed);
    map.fitBounds(latLngBounds(ringToLatLngs(corners)), {
      paddingTopLeft: [covered.left + 40, covered.top + 40],
      paddingBottomRight: [covered.right + 40, covered.bottom + 40],
      maxZoom: 19,
    });
  }, [map, editing, corners, sheetClosed]);

  // A crosshair says "a click here adds a corner".
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = editing === null ? "" : "crosshair";
    return () => {
      container.style.cursor = "";
    };
  }, [map, editing]);
  return null;
}

/**
 * The zone being drawn: its outline (dashed, so it reads as unsaved) and a square handle per
 * corner. Drag a handle to move the corner; click it to remove the corner.
 */
function DraftLayer({ draft, onChange }: { draft: ZoneDraft; onChange: (draft: ZoneDraft) => void }) {
  // Leaflet calls these handlers long after render; the ref always holds the latest draft.
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const dragStarted = useRef(false);
  const positions = ringToLatLngs(draft.corners);
  const Outline = draft.corners.length >= MIN_CORNERS ? Polygon : Polyline;

  return (
    <>
      {positions.length >= 2 && (
        <>
          <Outline
            positions={positions}
            pathOptions={{ color: "#ffffff", weight: 6, opacity: 0.9, fill: false, interactive: false }}
          />
          <Outline
            positions={positions}
            pathOptions={{
              color: ZONE_COLOR,
              weight: 3,
              dashArray: "8 6",
              fillColor: ZONE_COLOR,
              fillOpacity: 0.15,
              interactive: false,
            }}
          />
        </>
      )}
      {positions.map((position, index) => (
        <Marker
          key={index}
          position={position}
          icon={cornerIcon}
          draggable
          bubblingMouseEvents={false}
          keyboard={false}
          zIndexOffset={3000}
          eventHandlers={{
            dragstart: () => {
              dragStarted.current = true;
            },
            drag: (event) => {
              const point = latLngToCorner((event.target as { getLatLng(): { lat: number; lng: number } }).getLatLng());
              onChange(moveCorner(draftRef.current, index, point, dragStarted.current));
              dragStarted.current = false;
            },
            click: () => onChange(removeCorner(draftRef.current, index)),
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} className="bracelet-tooltip">
            Titik {index + 1}: geser untuk memindahkan
            {draft.corners.length > MIN_CORNERS ? ", klik untuk menghapus" : ""}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
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
  /** The phone's sheet is closed all the way, so more of the map is visible. */
  sheetClosed: boolean;
  onSelect: (braceletId: number) => void;
  onClearSelection: () => void;
  /** A zone being drawn on the Zona tab of Data master; clicks then add corners. */
  zoneDraft: ZoneDraft | null;
  onZoneDraftChange: (draft: ZoneDraft) => void;
}

export default function MapView({
  zones,
  fixes,
  openAlerts,
  assignments,
  now,
  selection,
  trail,
  sheetClosed,
  onSelect,
  onClearSelection,
  zoneDraft,
  onZoneDraftChange,
}: Props) {
  const [initialLayer] = useState(readLayer);
  // Retired zones have no bracelets, so they'd only clutter the map. The zone being edited is
  // drawn by DraftLayer instead, so the old outline doesn't sit under the new one.
  const shownZones = zones.filter((z) => z.status === "active" && z.id !== zoneDraft?.zoneId);
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

      <FitToZones zones={zones.filter((z) => z.status === "active")} sheetClosed={sheetClosed} />
      <FlyToSelection selection={selection} fixes={fixes} sheetClosed={sheetClosed} />
      <FitToDraft draft={zoneDraft} sheetClosed={sheetClosed} />
      <MapEvents
        onClick={(at) => {
          if (zoneDraft) onZoneDraftChange(addCorner(zoneDraft, latLngToCorner(at)));
          else onClearSelection();
        }}
      />

      {shownZones.map((zone) => {
        const positions = ringToLatLngs(zone.boundary.coordinates[0]);
        return (
          <Fragment key={zone.id}>
            {/* A white halo under the outline keeps it readable on any imagery, light or dark. */}
            <Polygon
              positions={positions}
              pathOptions={{ color: "#ffffff", weight: 6, opacity: 0.85, fill: false, interactive: false }}
            />
            <Polygon
              positions={positions}
              pathOptions={{ color: ZONE_COLOR, weight: 3, fillColor: ZONE_COLOR, fillOpacity: 0.1 }}
            >
              <Tooltip sticky className="bracelet-tooltip">
                {zone.name}
              </Tooltip>
            </Polygon>
          </Fragment>
        );
      })}

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
      {zoneDraft && <DraftLayer draft={zoneDraft} onChange={onZoneDraftChange} />}

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
