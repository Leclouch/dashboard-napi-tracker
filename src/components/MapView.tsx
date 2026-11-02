"use client";

// Leaflet touches `window`, so this file is only loaded in the browser (see Dashboard: ssr false).
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { divIcon, latLngBounds, type DivIcon, type LatLngTuple } from "leaflet";
import {
  LayerGroup,
  LayersControl,
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { FIX_STATUS_LABEL, EPISODE_LABEL, formatAgo, formatDistance } from "@/lib/format";
import { glyphSvg } from "@/lib/glyph";
import type { DisplayStatus, Selection } from "@/lib/status";
import type { Episode, Fix, Zone } from "@/lib/types";

/** Placeholder until zones load: around Lapas Cebongan. */
const DEFAULT_CENTER: LatLngTuple = [-7.74, 110.3423];
/** Close enough to tell which side of the fence a bracelet is on. */
const SELECTED_MIN_ZOOM = 18;

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
    const size = emphasised ? 34 : 26;
    icon = divIcon({
      className: `bracelet-marker${selected ? " is-selected" : ""}`,
      html: glyphSvg(status, size),
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
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo([fix.lat, fix.lng], Math.max(map.getZoom(), SELECTED_MIN_ZOOM), {
      animate: !reducedMotion,
      duration: 0.6,
    });
  }, [map, selection]);
  return null;
}

function ClearSelectionOnMapClick({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear });
  return null;
}

interface Props {
  zones: Zone[];
  fixes: Fix[];
  openAlerts: Episode[];
  now: number;
  selection: Selection | null;
  onSelect: (braceletId: number) => void;
  onClearSelection: () => void;
}

export default function MapView({
  zones,
  fixes,
  openAlerts,
  now,
  selection,
  onSelect,
  onClearSelection,
}: Props) {
  const alertByBracelet = new Map(openAlerts.map((a) => [a.braceletId, a]));

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={17} className="h-full w-full">
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Peta jalan">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satelit">
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
      <ClearSelectionOnMapClick onClear={onClearSelection} />

      {zones.map((zone) => (
        <Polygon
          key={zone.id}
          positions={ringToLatLngs(zone.boundary.coordinates[0])}
          pathOptions={{ color: "#14233b", weight: 2, fillOpacity: 0.06 }}
        >
          <Tooltip sticky className="bracelet-tooltip">
            {zone.name}
          </Tooltip>
        </Polygon>
      ))}

      {fixes.map((fix) => {
        const alert = alertByBracelet.get(fix.braceletId);
        const status: DisplayStatus = alert?.type ?? fix.status;
        const statusText = alert ? EPISODE_LABEL[alert.type] : FIX_STATUS_LABEL[fix.status];
        const selected = fix.braceletId === selection?.braceletId;
        const distance = formatDistance(fix.distanceOutsideMeters);
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
