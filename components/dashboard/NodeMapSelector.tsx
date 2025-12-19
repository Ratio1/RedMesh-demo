'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  NavigationControl,
  Marker,
} from 'react-map-gl/maplibre';
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

interface NodeCluster {
  key: string;
  country: string;
  lat: number;
  lng: number;
  nodes: NodePeer[];
}

export default function NodeMapSelector({
  peers,
  selectedPeers,
  onSelectionChange,
  onTouched,
}: NodeMapSelectorProps): JSX.Element {
  const [mapError, setMapError] = useState(false);

  // Group nodes by country/location
  const clusters = useMemo<NodeCluster[]>(() => {
    const grouped: Record<string, NodeCluster> = {};

    peers.forEach((peer) => {
      const key = peer.country || `${peer.lat.toFixed(2)},${peer.lng.toFixed(2)}`;
      if (!grouped[key]) {
        grouped[key] = {
          key,
          country: peer.country || 'Unknown',
          lat: peer.lat,
          lng: peer.lng,
          nodes: [],
        };
      }
      grouped[key].nodes.push(peer);
    });

    return Object.values(grouped);
  }, [peers]);

  // Add one node from cluster to selection
  const handleAddOne = useCallback(
    (cluster: NodeCluster) => {
      onTouched?.();
      const unselectedNode = cluster.nodes.find((n) => !selectedPeers.includes(n.address));
      if (unselectedNode) {
        onSelectionChange([...selectedPeers, unselectedNode.address]);
      }
    },
    [selectedPeers, onSelectionChange, onTouched]
  );

  // Remove one node from cluster selection
  const handleRemoveOne = useCallback(
    (cluster: NodeCluster) => {
      onTouched?.();
      const selectedNode = cluster.nodes.find((n) => selectedPeers.includes(n.address));
      if (selectedNode) {
        onSelectionChange(selectedPeers.filter((addr) => addr !== selectedNode.address));
      }
    },
    [selectedPeers, onSelectionChange, onTouched]
  );

  // Toggle single node
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
  const initialViewState = useMemo(() => {
    if (peers.length === 0) {
      return { latitude: 20, longitude: 10, zoom: 1.5 };
    }

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

    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const lngDiff = maxLng - minLng;
    const latDiff = maxLat - minLat;
    const maxDiff = Math.max(lngDiff, latDiff);

    let zoom = 1.5;
    if (maxDiff < 5) zoom = 6;
    else if (maxDiff < 10) zoom = 5;
    else if (maxDiff < 30) zoom = 4;
    else if (maxDiff < 60) zoom = 3;
    else if (maxDiff < 120) zoom = 2;

    return { latitude: centerLat, longitude: centerLng, zoom };
  }, [peers]);

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
        <span>Use +/- to add or remove nodes</span>
        <span>
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1 align-middle" />
          Selected ({selectedPeers.length}/{peers.length})
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
          >
            <NavigationControl position="top-left" />

            {/* Render clusters */}
            {clusters.map((cluster) => {
              const selectedCount = cluster.nodes.filter((n) => selectedPeers.includes(n.address)).length;
              const totalCount = cluster.nodes.length;
              const allSelected = selectedCount === totalCount;
              const noneSelected = selectedCount === 0;

              if (totalCount === 1) {
                // Single node - simple toggle button
                const node = cluster.nodes[0];
                const isSelected = selectedPeers.includes(node.address);

                return (
                  <Marker
                    key={node.address}
                    latitude={node.lat}
                    longitude={node.lng}
                    anchor="center"
                  >
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => handleNodeClick(node)}
                        className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          isSelected
                            ? 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50'
                            : 'bg-slate-600 border-slate-500 hover:bg-slate-500'
                        }`}
                        title={`${node.label} - Click to ${isSelected ? 'deselect' : 'select'}`}
                      >
                        {isSelected ? (
                          <span className="text-white text-xs">✓</span>
                        ) : (
                          <span className="text-white text-[10px]">1</span>
                        )}
                      </button>
                      <div className="mt-1 text-[9px] text-slate-400 whitespace-nowrap">
                        {cluster.country}
                      </div>
                    </div>
                  </Marker>
                );
              }

              // Multi-node cluster with +/- controls
              return (
                <Marker
                  key={cluster.key}
                  latitude={cluster.lat}
                  longitude={cluster.lng}
                  anchor="center"
                >
                  <div className="flex flex-col items-center">
                    <div className="flex items-center">
                      {/* Minus button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveOne(cluster)}
                        disabled={noneSelected}
                        className={`flex items-center justify-center w-7 h-7 rounded-l-full border-2 border-r-0 transition-all ${
                          noneSelected
                            ? 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-600 border-slate-500 text-white hover:bg-red-600 hover:border-red-500'
                        }`}
                        title="Remove one node from selection"
                      >
                        <span className="text-sm font-bold leading-none">−</span>
                      </button>

                      {/* Count display */}
                      <div
                        className={`flex items-center justify-center h-7 px-2 border-y-2 text-xs font-bold min-w-[40px] ${
                          allSelected
                            ? 'bg-red-500 border-red-400 text-white'
                            : noneSelected
                            ? 'bg-slate-700 border-slate-600 text-slate-300'
                            : 'bg-amber-500 border-amber-400 text-white'
                        }`}
                        title={`${selectedCount} of ${totalCount} nodes selected in ${cluster.country}`}
                      >
                        {selectedCount}/{totalCount}
                      </div>

                      {/* Plus button */}
                      <button
                        type="button"
                        onClick={() => handleAddOne(cluster)}
                        disabled={allSelected}
                        className={`flex items-center justify-center w-7 h-7 rounded-r-full border-2 border-l-0 transition-all ${
                          allSelected
                            ? 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-600 border-slate-500 text-white hover:bg-green-600 hover:border-green-500'
                        }`}
                        title="Add one node to selection"
                      >
                        <span className="text-sm font-bold leading-none">+</span>
                      </button>
                    </div>

                    {/* Country label */}
                    <div className="mt-1 text-[9px] text-slate-400 whitespace-nowrap">
                      {cluster.country}
                    </div>
                  </div>
                </Marker>
              );
            })}
          </Map>

          {/* Gradient overlay */}
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-slate-950/30 via-transparent to-slate-950/30" />

          {/* Map error fallback */}
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-800/90 text-sm text-amber-300">
              Map tiles unavailable. Use list view to select nodes.
            </div>
          )}
        </div>
      </div>

      {/* Cluster summary below map */}
      {clusters.length > 0 && (
        <div className="flex flex-wrap gap-2 text-[10px]">
          {clusters.map((cluster) => {
            const selectedCount = cluster.nodes.filter((n) => selectedPeers.includes(n.address)).length;
            const totalCount = cluster.nodes.length;

            return (
              <div
                key={cluster.key}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/50 border border-slate-700"
              >
                <span className={`w-2 h-2 rounded-full ${
                  selectedCount === totalCount
                    ? 'bg-red-500'
                    : selectedCount > 0
                    ? 'bg-amber-500'
                    : 'bg-slate-500'
                }`} />
                <span className="text-slate-300">{cluster.country}</span>
                <span className="text-slate-500">{selectedCount}/{totalCount}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}