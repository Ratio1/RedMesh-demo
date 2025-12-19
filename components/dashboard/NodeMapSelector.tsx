'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Layer,
  LayerProps,
  NavigationControl,
  Source,
  Marker,
} from 'react-map-gl/maplibre';
import type { FeatureCollection, Point } from 'geojson';
import type { NodePeer } from '@/components/layout/AppConfigContext';

// Dynamically import Map to avoid SSR issues
const Map = dynamic(
  () => import('react-map-gl/maplibre').then((mod) => mod.Map),
  { ssr: false }
);

interface NodeMapSelectorProps {
  peers: NodePeer[];
  selectedPeers: string[];
  onSelectionChange: (selected: string[]) => void;
  onTouched?: () => void;
}

// Layer styles for selected nodes
const selectedNodeLayer: LayerProps = {
  id: 'selected-nodes',
  type: 'circle',
  source: 'selected-nodes',
  paint: {
    'circle-color': '#d62828',
    'circle-radius': 12,
    'circle-stroke-color': '#ff4444',
    'circle-stroke-width': 3,
    'circle-blur': 0.1,
  },
};

const selectedNodeGlowLayer: LayerProps = {
  id: 'selected-node-glow',
  type: 'circle',
  source: 'selected-nodes',
  paint: {
    'circle-color': '#ff174f',
    'circle-opacity': 0.5,
    'circle-radius': 24,
    'circle-blur': 1,
  },
};

// Layer styles for unselected nodes
const unselectedNodeLayer: LayerProps = {
  id: 'unselected-nodes',
  type: 'circle',
  source: 'unselected-nodes',
  paint: {
    'circle-color': '#475569',
    'circle-radius': 8,
    'circle-stroke-color': '#64748b',
    'circle-stroke-width': 2,
    'circle-blur': 0.1,
  },
};

type HoverInfo = {
  peer: NodePeer;
  x: number;
  y: number;
};

export default function NodeMapSelector({
  peers,
  selectedPeers,
  onSelectionChange,
  onTouched,
}: NodeMapSelectorProps): JSX.Element {
  const [mapError, setMapError] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  // Create GeoJSON for selected nodes
  const selectedGeoJson = useMemo<FeatureCollection<Point, { address: string; label: string }>>(() => {
    const features = peers
      .filter((p) => selectedPeers.includes(p.address))
      .map((peer) => ({
        type: 'Feature' as const,
        properties: {
          address: peer.address,
          label: peer.label,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [peer.lng, peer.lat],
        },
      }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [peers, selectedPeers]);

  // Create GeoJSON for unselected nodes
  const unselectedGeoJson = useMemo<FeatureCollection<Point, { address: string; label: string }>>(() => {
    const features = peers
      .filter((p) => !selectedPeers.includes(p.address))
      .map((peer) => ({
        type: 'Feature' as const,
        properties: {
          address: peer.address,
          label: peer.label,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [peer.lng, peer.lat],
        },
      }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [peers, selectedPeers]);

  const handleNodeClick = useCallback(
    (peer: NodePeer) => {
      onTouched?.();
      const isSelected = selectedPeers.includes(peer.address);
      if (isSelected) {
        onSelectionChange(selectedPeers.filter((addr) => addr !== peer.address));
      } else {
        onSelectionChange([...selectedPeers, peer.address]);
      }
    },
    [selectedPeers, onSelectionChange, onTouched]
  );

  // Calculate map bounds to fit all peers
  const bounds = useMemo(() => {
    if (peers.length === 0) return null;

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    peers.forEach((peer) => {
      minLng = Math.min(minLng, peer.lng);
      maxLng = Math.max(maxLng, peer.lng);
      minLat = Math.min(minLat, peer.lat);
      maxLat = Math.max(maxLat, peer.lat);
    });

    // Add padding
    const lngPadding = Math.max((maxLng - minLng) * 0.2, 10);
    const latPadding = Math.max((maxLat - minLat) * 0.2, 10);

    return {
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding,
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
    };
  }, [peers]);

  const initialViewState = useMemo(() => {
    if (!bounds) {
      return { latitude: 20, longitude: 10, zoom: 1.5 };
    }

    const centerLng = (bounds.minLng + bounds.maxLng) / 2;
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;

    // Calculate appropriate zoom level
    const lngDiff = bounds.maxLng - bounds.minLng;
    const latDiff = bounds.maxLat - bounds.minLat;
    const maxDiff = Math.max(lngDiff, latDiff);

    let zoom = 1.5;
    if (maxDiff < 10) zoom = 5;
    else if (maxDiff < 30) zoom = 4;
    else if (maxDiff < 60) zoom = 3;
    else if (maxDiff < 120) zoom = 2;

    return { latitude: centerLat, longitude: centerLng, zoom };
  }, [bounds]);

  if (peers.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/30 p-4 text-center">
        <p className="text-sm text-slate-400">No nodes with location data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selection info */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Click on nodes to select/deselect them</span>
        <span>
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1 align-middle" />
          Selected ({selectedPeers.length})
          <span className="mx-2">|</span>
          <span className="inline-block w-3 h-3 rounded-full bg-slate-500 mr-1 align-middle" />
          Unselected ({peers.length - selectedPeers.length})
        </span>
      </div>

      {/* Map */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/80 shadow-inner shadow-slate-950/60">
        <div className="relative h-[300px] w-full overflow-hidden rounded-xl">
          <Map
            initialViewState={initialViewState}
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            reuseMaps
            style={{
              width: '100%',
              height: '100%',
              filter: 'saturate(0.85) brightness(0.95)',
            }}
            onError={() => setMapError(true)}
            mapLib={import('maplibre-gl')}
            attributionControl={false}
            interactiveLayerIds={['selected-nodes', 'unselected-nodes']}
            onClick={(event) => {
              const feature = event.features?.[0];
              if (feature) {
                const address = feature.properties?.address as string;
                const peer = peers.find((p) => p.address === address);
                if (peer) {
                  handleNodeClick(peer);
                }
              }
            }}
            onMouseMove={(event) => {
              const feature = event.features?.[0];
              if (feature) {
                const address = feature.properties?.address as string;
                const peer = peers.find((p) => p.address === address);
                if (peer) {
                  setHoverInfo({
                    peer,
                    x: event.point.x,
                    y: event.point.y,
                  });
                }
              } else {
                setHoverInfo(null);
              }
            }}
            onMouseLeave={() => setHoverInfo(null)}
            cursor={hoverInfo ? 'pointer' : 'grab'}
          >
            <NavigationControl position="top-left" />

            {/* Unselected nodes layer */}
            <Source id="unselected-nodes" type="geojson" data={unselectedGeoJson}>
              <Layer {...unselectedNodeLayer} />
            </Source>

            {/* Selected nodes layers (glow + main) */}
            <Source id="selected-nodes" type="geojson" data={selectedGeoJson}>
              <Layer {...selectedNodeGlowLayer} />
              <Layer {...selectedNodeLayer} />
            </Source>
          </Map>

          {/* Gradient overlay */}
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-slate-950/30 via-transparent to-slate-950/30" />

          {/* Hover tooltip */}
          {hoverInfo && (
            <div
              className="pointer-events-none absolute z-20 -translate-y-full rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-lg shadow-black/40"
              style={{ left: hoverInfo.x + 10, top: hoverInfo.y - 10 }}
            >
              <p className="font-semibold text-slate-50">
                {hoverInfo.peer.label || 'Worker Node'}
              </p>
              {hoverInfo.peer.country && (
                <p className="text-slate-400">{hoverInfo.peer.country}</p>
              )}
              <p className="text-slate-500 font-mono text-[10px] mt-1">
                {hoverInfo.peer.address.length > 30
                  ? `${hoverInfo.peer.address.slice(0, 15)}...${hoverInfo.peer.address.slice(-12)}`
                  : hoverInfo.peer.address}
              </p>
              <p className={`mt-1 text-[10px] ${selectedPeers.includes(hoverInfo.peer.address) ? 'text-red-400' : 'text-slate-500'}`}>
                {selectedPeers.includes(hoverInfo.peer.address) ? '● Selected' : '○ Click to select'}
              </p>
            </div>
          )}

          {/* Map error fallback */}
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-800/90 text-sm text-amber-300">
              Map tiles unavailable. Use list view to select nodes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}