"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import { countryCodeToName } from "@/lib/gis";
import type {
  NodeCountryStat,
  NodeGeoResponse,
  NodePeer,
} from "@/lib/api/nodes";
import type { FeatureCollection, Point } from "geojson";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Layer,
  LayerProps,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre";

const Map = dynamic(
  () => import("react-map-gl/maplibre").then((mod) => mod.Map),
  { ssr: false }
);

const nodeLayer: LayerProps = {
  id: "nodes",
  type: "circle",
  source: "nodes",
  paint: {
    "circle-color": "#d62828",
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["get", "count"],
      1,
      8,
      10,
      14,
      25,
      24,
    ],
    "circle-stroke-color": "#ff0033",
    "circle-stroke-width": 2,
    "circle-blur": 0.2,
  },
};

const nodeGlowLayer: LayerProps = {
  id: "node-glow",
  type: "circle",
  source: "nodes",
  paint: {
    "circle-color": "#ff174f",
    "circle-opacity": 0.5,
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["get", "count"],
      1,
      20,
      10,
      32,
      25,
      42,
    ],
    "circle-blur": 1.35,
  },
};

const nodeLabelLayer: LayerProps = {
  id: "node-labels",
  type: "symbol",
  source: "nodes",
  layout: {
    "text-field": ["to-string", ["get", "count"]],
    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
    "text-size": 11,
    "text-anchor": "center",
    "text-offset": [0, 0],
  },
  paint: {
    "text-color": "#0a1120",
    "text-halo-color": "#f5f8ff",
    "text-halo-width": 1.4,
  },
};

type HoverInfo = { location: string; count: number; x: number; y: number };

export default function MeshPage(): JSX.Element {
  const [geoJson, setGeoJson] = useState<FeatureCollection<
    Point,
    { code: string; count: number; label?: string; address?: string }
  > | null>(null);
  const [peers, setPeers] = useState<NodePeer[]>([]);
  const [stats, setStats] = useState<NodeCountryStat[]>([]);
  const [dataSource, setDataSource] = useState<"live" | "mock">("mock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/nodes", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | NodeGeoResponse
          | { message?: string }
          | null;
        const hasGeoJson =
          payload && typeof payload === "object" && "geoJson" in payload;
        if (!response.ok || !hasGeoJson) {
          const message =
            payload &&
            typeof payload === "object" &&
            "message" in payload &&
            typeof payload.message === "string"
              ? payload.message
              : "Unable to load mesh nodes.";
          throw new Error(message);
        }
        if (cancelled) return;
        const data = payload as NodeGeoResponse;
        setGeoJson(data.geoJson);
        setPeers(data.peers ?? []);
        setStats(data.stats ?? []);
        setDataSource(data.source ?? "live");
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Unable to load mesh nodes.";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const orderedPeers = useMemo(
    () => [...peers].sort((a, b) => a.label.localeCompare(b.label)),
    [peers]
  );
  const orderedStats = useMemo(
    () => [...stats].sort((a, b) => b.count - a.count),
    [stats]
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Mesh
          </p>
          <h1 className="text-3xl font-semibold text-slate-50">Node map</h1>
          <p className="text-sm text-slate-300">
            Live registry of active nodes aggregated by country. Data is sourced
            from the Ratio1 oracles service and falls back to mock counts if the
            endpoint is unavailable.
          </p>
        </header>

        <Card>
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 p-1 shadow-inner shadow-slate-950/60">
            <div className="relative h-[520px] w-full overflow-hidden rounded-2xl">
              <Map
                initialViewState={{
                  latitude: 20,
                  longitude: 10,
                  zoom: 1.3,
                }}
                mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                reuseMaps
                style={{
                  width: "100%",
                  height: "100%",
                  filter: "saturate(0.85) brightness(0.95)",
                }}
                onError={() => setMapError(true)}
                mapLib={import("maplibre-gl")}
                attributionControl={false}
                interactiveLayerIds={["nodes"]}
                onMouseMove={(event) => {
                  const feature = event.features?.[0];
                  if (feature) {
                    const properties = feature.properties as Record<
                      string,
                      unknown
                    >;
                    const label = String(properties.label ?? "Unknown node");
                    const location = properties.code
                      ? countryCodeToName(String(properties.code)) ??
                        String(properties.code)
                      : label;
                    setHoverInfo({
                      location,
                      count: Number(properties.count ?? 0),
                      x: event.point.x,
                      y: event.point.y,
                    });
                  } else {
                    setHoverInfo(null);
                  }
                }}
                onMouseLeave={() => setHoverInfo(null)}
              >
                <NavigationControl position="top-left" />
                {geoJson && (
                  <Source id="nodes" type="geojson" data={geoJson}>
                    <Layer {...nodeGlowLayer} />
                    <Layer {...nodeLayer} />
                    <Layer {...nodeLabelLayer} />
                  </Source>
                )}
              </Map>
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-slate-950/60 via-slate-950/40 to-slate-950/60" />
              {hoverInfo && (
                <div
                  className="pointer-events-none absolute z-20 -translate-y-3 rounded-lg border border-white/10 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-lg shadow-black/40"
                  style={{ left: hoverInfo.x, top: hoverInfo.y }}
                >
                  <p className="font-semibold text-slate-50">
                    {hoverInfo.location}
                  </p>
                  <p className="text-slate-300">
                    {hoverInfo.count} node{hoverInfo.count === 1 ? "" : "s"}
                  </p>
                </div>
              )}
              {mapError && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 text-sm text-amber-700 ring-1 ring-amber-200">
                  Map tiles unavailable in this environment. Check network
                  access.
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card
          title="Nodes by country"
          description="Aggregated counts from the active node registry."
        >
          {loading && (
            <p className="text-sm text-slate-300">Loading node registry...</p>
          )}
          {!loading && error && (
            <p className="text-sm text-rose-200">
              Unable to load nodes: {error}
            </p>
          )}
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    <th className="px-3 py-2 font-semibold">Location</th>
                    <th className="px-3 py-2 font-semibold">Total nodes</th>
                    <th className="px-3 py-2 font-semibold">Data center</th>
                    <th className="px-3 py-2 font-semibold text-right">
                      KYC/KYB
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {orderedStats.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-3 text-sm text-slate-300"
                      >
                        No nodes reported.
                      </td>
                    </tr>
                  )}
                  {orderedStats.map((entry) => (
                    <tr key={entry.code} className="text-sm text-slate-200">
                      <td className="px-3 py-3 font-semibold text-slate-100">
                        {countryCodeToName(entry.code) ?? entry.code}
                      </td>
                      <td className="px-3 py-3 text-slate-300">
                        {entry.count}
                      </td>
                      <td className="px-3 py-3 text-slate-300">
                        {entry.datacenterCount}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-300">
                        {entry.kybCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
