'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import AppShell from '@/components/layout/AppShell';
import Card from '@/components/ui/Card';
import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Layer, LayerProps, NavigationControl, Source } from 'react-map-gl/maplibre';

const Map = dynamic(() => import('react-map-gl/maplibre').then((mod) => mod.Map), { ssr: false });

type MeshNode = {
  alias: string;
  location: string;
  latencyMs: number;
  coords: { lat: number; lng: number };
  status?: 'online' | 'degraded' | 'offline';
};

const NODES: MeshNode[] = [
  { alias: 'Edge-France', location: 'France', coords: { lat: 46.2276, lng: 2.2137 }, status: 'online', latencyMs: 42 },
  { alias: 'Edge-USA-1', location: 'United States', coords: { lat: 39.8283, lng: -98.5795 }, status: 'online', latencyMs: 38 },
  { alias: 'Edge-USA-2', location: 'United States', coords: { lat: 39.8283, lng: -98.5795 }, status: 'online', latencyMs: 44 },
  { alias: 'Edge-USA-3', location: 'United States', coords: { lat: 39.8283, lng: -98.5795 }, status: 'online', latencyMs: 46 },
  { alias: 'Edge-Japan', location: 'Japan', coords: { lat: 36.2048, lng: 138.2529 }, status: 'degraded', latencyMs: 95 },
  { alias: 'Edge-Singapore', location: 'Singapore', coords: { lat: 1.3521, lng: 103.8198 }, status: 'online', latencyMs: 78 },
  { alias: 'Edge-Australia', location: 'Australia', coords: { lat: -25.2744, lng: 133.7751 }, status: 'offline', latencyMs: 0 },
  { alias: 'Edge-UK', location: 'United Kingdom', coords: { lat: 55.3781, lng: -3.436 }, status: 'online', latencyMs: 30 },
  { alias: 'Edge-Germany', location: 'Germany', coords: { lat: 51.1657, lng: 10.4515 }, status: 'online', latencyMs: 35 },
  { alias: 'Edge-India', location: 'India', coords: { lat: 20.5937, lng: 78.9629 }, status: 'degraded', latencyMs: 105 },
  { alias: 'Edge-Brazil', location: 'Brazil', coords: { lat: -14.235, lng: -51.9253 }, status: 'online', latencyMs: 82 },
  { alias: 'Edge-Canada', location: 'Canada', coords: { lat: 56.1304, lng: -106.3468 }, status: 'online', latencyMs: 50 },
  { alias: 'Edge-SouthAfrica', location: 'South Africa', coords: { lat: -30.5595, lng: 22.9375 }, status: 'online', latencyMs: 120 },
  { alias: 'Edge-UAE', location: 'United Arab Emirates', coords: { lat: 23.4241, lng: 53.8478 }, status: 'online', latencyMs: 70 },
  { alias: 'Edge-Spain', location: 'Spain', coords: { lat: 40.4637, lng: -3.7492 }, status: 'online', latencyMs: 48 },
  { alias: 'Edge-Romania-1', location: 'Romania', coords: { lat: 45.9432, lng: 24.9668 }, status: 'online', latencyMs: 36 },
  { alias: 'Edge-Romania-2', location: 'Romania', coords: { lat: 45.9432, lng: 24.9668 }, status: 'online', latencyMs: 39 },
  { alias: 'Edge-Romania-3', location: 'Romania', coords: { lat: 45.9432, lng: 24.9668 }, status: 'degraded', latencyMs: 58 }
];

const groupedNodes = NODES.reduce<Record<string, { location: string; coords: MeshNode['coords']; status: MeshNode['status']; count: number }>>(
  (acc, node) => {
    const key = `${node.coords.lat},${node.coords.lng}`;
    if (!acc[key]) {
      acc[key] = { location: node.location, coords: node.coords, status: node.status ?? 'online', count: 0 };
    }
    acc[key].count += 1;
    // degrade status if any node is degraded/offline
    if (node.status === 'offline') {
      acc[key].status = 'offline';
    } else if (node.status === 'degraded' && acc[key].status !== 'offline') {
      acc[key].status = 'degraded';
    }
    return acc;
  },
  {}
);

const nodeFeatures: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: Object.values(groupedNodes).map((entry) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [entry.coords.lng, entry.coords.lat]
    },
    properties: {
      status: entry.status ?? 'online',
      location: entry.location,
      count: entry.count
    }
  }))
};

const nodeLayer: LayerProps = {
  id: 'nodes',
  type: 'circle',
  source: 'nodes',
  paint: {
    'circle-color': '#d62828',
    'circle-radius': 8,
    'circle-stroke-color': '#ff0033',
    'circle-stroke-width': 2,
    'circle-blur': 0.15
  }
};

const nodeGlowLayer: LayerProps = {
  id: 'node-glow',
  type: 'circle',
  source: 'nodes',
  paint: {
    'circle-color': '#ff174f',
    'circle-opacity': 0.55,
    'circle-radius': 22,
    'circle-blur': 1.2
  }
};

const nodeLabelLayer: LayerProps = {
  id: 'node-labels',
  type: 'symbol',
  source: 'nodes',
  layout: {
    'text-field': ['to-string', ['get', 'count']],
    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
    'text-size': 10,
    'text-anchor': 'center',
    'text-offset': [0, 0]
  },
  paint: {
    'text-color': '#0a1120',
    'text-halo-color': '#f5f8ff',
    'text-halo-width': 1.4
  }
};

export default function MeshPage(): JSX.Element {
  const [mapError, setMapError] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ location: string; count: number; x: number; y: number } | null>(null);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Mesh</p>
          <h1 className="text-3xl font-semibold text-slate-50">Node map</h1>
          <p className="text-sm text-slate-300">
            Visualize node distribution and inspect aliases with their declared locations.
          </p>
        </header>

        <Card>
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 p-1 shadow-inner shadow-slate-950/60">
            <div className="relative h-[520px] w-full overflow-hidden rounded-2xl">
              <Map
                initialViewState={{
                  latitude: 15,
                  longitude: 20,
                  zoom: 1.3
                }}
                mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                reuseMaps
                style={{ width: '100%', height: '100%', filter: 'saturate(0.8) brightness(0.9)' }}
                onError={() => setMapError(true)}
                mapLib={import('maplibre-gl')}
                attributionControl={false}
                interactiveLayerIds={['nodes']}
                onMouseMove={(event) => {
                  const feature = event.features?.[0];
                  if (feature) {
                    const properties = feature.properties as Record<string, unknown>;
                    setHoverInfo({
                      location: String(properties.location ?? 'Unknown'),
                      count: Number(properties.count ?? 0),
                      x: event.point.x,
                      y: event.point.y
                    });
                  } else {
                    setHoverInfo(null);
                  }
                }}
                onMouseLeave={() => setHoverInfo(null)}
              >
                <NavigationControl position="top-left" />
                <Source id="nodes" type="geojson" data={nodeFeatures}>
                  <Layer {...nodeGlowLayer} />
                  <Layer {...nodeLayer} />
                  <Layer {...nodeLabelLayer} />
                </Source>
              </Map>
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-slate-950/60 via-slate-950/40 to-slate-950/60" />
              {hoverInfo && (
                <div
                  className="pointer-events-none absolute z-20 -translate-y-3 rounded-lg border border-white/10 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-lg shadow-black/40"
                  style={{ left: hoverInfo.x, top: hoverInfo.y }}
                >
                  <p className="font-semibold text-slate-50">{hoverInfo.location}</p>
                  <p className="text-slate-300">{hoverInfo.count} node{hoverInfo.count === 1 ? '' : 's'}</p>
                </div>
              )}
              {mapError && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 text-sm text-amber-700 ring-1 ring-amber-200">
                  Map tiles unavailable in this environment. Check network access.
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card title="Nodes" description="Alias and location registry">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left">
              <thead>
                <tr className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  <th className="px-3 py-2 font-semibold">Node Alias</th>
                  <th className="px-3 py-2 font-semibold">Location</th>
                  <th className="px-3 py-2 font-semibold">Latency</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {NODES.map((node) => (
                  <tr key={node.alias} className="text-sm text-slate-200">
                    <td className="px-3 py-3 font-semibold text-slate-100">{node.alias}</td>
                    <td className="px-3 py-3 text-slate-300">{node.location}</td>
                    <td className="px-3 py-3 text-slate-300">{node.latencyMs ? `${node.latencyMs} ms` : '—'}</td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={clsx(
                          'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
                          node.status === 'online' && 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/40',
                          node.status === 'degraded' && 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40',
                          node.status === 'offline' && 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-500/40'
                        )}
                      >
                        {node.status ?? 'unknown'}
                      </span>
                   </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
