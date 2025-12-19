'use client';

import { memo } from 'react';

// ============================================================================
// Types
// ============================================================================

type LoaderSize = 'sm' | 'md' | 'lg' | 'xl';
type LoaderVariant = 'mesh' | 'spinner' | 'pulse';

interface LoaderProps {
  /** Size of the loader */
  size?: LoaderSize;
  /** Visual variant */
  variant?: LoaderVariant;
  /** Optional message to display below the loader */
  message?: string;
  /** Additional CSS classes */
  className?: string;
}

interface FullPageLoaderProps {
  /** Loading message */
  message?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SIZE_CONFIG = {
  sm: { container: 48, node: 6, text: 'text-xs' },
  md: { container: 72, node: 8, text: 'text-sm' },
  lg: { container: 96, node: 10, text: 'text-base' },
  xl: { container: 144, node: 14, text: 'text-lg' },
} as const;

// Hexagonal mesh node positions (percentage-based for scalability)
const MESH_NODES = [
  { x: 50, y: 12 },  // top
  { x: 88, y: 31 },  // top-right
  { x: 88, y: 69 },  // bottom-right
  { x: 50, y: 88 },  // bottom
  { x: 12, y: 69 },  // bottom-left
  { x: 12, y: 31 },  // top-left
  { x: 50, y: 50 },  // center
] as const;

// Connections between nodes for mesh lines
const MESH_CONNECTIONS = [
  // Outer hexagon
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
  // Center spokes
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
] as const;

// ============================================================================
// Sub-components
// ============================================================================

/** Animated mesh node */
const MeshNode = memo(function MeshNode({
  x,
  y,
  size,
  delay,
  isCenter,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  isCenter: boolean;
}) {
  return (
    <g>
      {/* Pulse ring */}
      <circle
        cx={x}
        cy={y}
        r={size * 1.5}
        fill="none"
        stroke="rgb(16, 185, 129)"
        strokeWidth="0.5"
        opacity="0.4"
      >
        <animate
          attributeName="r"
          values={`${size};${size * 2.5};${size}`}
          dur="2s"
          repeatCount="indefinite"
          begin={`${delay}s`}
        />
        <animate
          attributeName="opacity"
          values="0.4;0;0.4"
          dur="2s"
          repeatCount="indefinite"
          begin={`${delay}s`}
        />
      </circle>
      {/* Core node */}
      <circle
        cx={x}
        cy={y}
        r={size}
        fill={isCenter ? 'rgb(52, 211, 153)' : 'rgb(16, 185, 129)'}
      >
        <animate
          attributeName="opacity"
          values="1;0.6;1"
          dur="1.5s"
          repeatCount="indefinite"
          begin={`${delay}s`}
        />
      </circle>
    </g>
  );
});

/** Animated connection line */
const MeshLine = memo(function MeshLine({
  x1,
  y1,
  x2,
  y2,
  delay,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="rgb(16, 185, 129)"
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.4"
    >
      <animate
        attributeName="opacity"
        values="0.2;0.6;0.2"
        dur="2s"
        repeatCount="indefinite"
        begin={`${delay}s`}
      />
    </line>
  );
});

/** Data packet traveling along a path */
const DataPacket = memo(function DataPacket({
  x1,
  y1,
  x2,
  y2,
  delay,
  duration,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
  duration: number;
}) {
  const pathId = `path-${x1}-${y1}-${x2}-${y2}`;

  return (
    <g>
      <path
        id={pathId}
        d={`M ${x1} ${y1} L ${x2} ${y2}`}
        fill="none"
        stroke="none"
      />
      <circle r="2" fill="rgb(110, 231, 183)">
        <animateMotion
          dur={`${duration}s`}
          repeatCount="indefinite"
          begin={`${delay}s`}
        >
          <mpath href={`#${pathId}`} />
        </animateMotion>
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          dur={`${duration}s`}
          repeatCount="indefinite"
          begin={`${delay}s`}
        />
      </circle>
    </g>
  );
});

// ============================================================================
// Main Loader Component
// ============================================================================

/**
 * RedMesh-themed loader with animated network mesh visualization.
 * Represents the distributed network nature of the mesh.
 */
function Loader({
  size = 'md',
  variant = 'mesh',
  message,
  className = '',
}: LoaderProps): JSX.Element {
  const config = SIZE_CONFIG[size];

  if (variant === 'spinner') {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 ${className}`}
        role="status"
        aria-label={message || 'Loading'}
      >
        <div
          className="relative"
          style={{ width: config.container, height: config.container }}
        >
          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" />
        </div>
        {message && (
          <p className={`${config.text} text-slate-300 animate-pulse`}>
            {message}
          </p>
        )}
        <span className="sr-only">{message || 'Loading'}</span>
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 ${className}`}
        role="status"
        aria-label={message || 'Loading'}
      >
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-full bg-emerald-500 animate-pulse"
              style={{
                width: config.node,
                height: config.node,
                animationDelay: `${i * 200}ms`,
              }}
            />
          ))}
        </div>
        {message && (
          <p className={`${config.text} text-slate-300`}>{message}</p>
        )}
        <span className="sr-only">{message || 'Loading'}</span>
      </div>
    );
  }

  // Default: mesh variant
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
      role="status"
      aria-label={message || 'Loading'}
    >
      <svg
        width={config.container}
        height={config.container}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Glow filter for visual enhancement */}
        <defs>
          <filter id="mesh-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#mesh-glow)">
          {/* Connection lines */}
          {MESH_CONNECTIONS.map(([fromIdx, toIdx], i) => (
            <MeshLine
              key={`line-${i}`}
              x1={MESH_NODES[fromIdx].x}
              y1={MESH_NODES[fromIdx].y}
              x2={MESH_NODES[toIdx].x}
              y2={MESH_NODES[toIdx].y}
              delay={i * 0.1}
            />
          ))}

          {/* Data packets on outer ring */}
          {MESH_CONNECTIONS.slice(0, 6).map(([fromIdx, toIdx], i) => (
            <DataPacket
              key={`packet-${i}`}
              x1={MESH_NODES[fromIdx].x}
              y1={MESH_NODES[fromIdx].y}
              x2={MESH_NODES[toIdx].x}
              y2={MESH_NODES[toIdx].y}
              delay={i * 0.3}
              duration={1.2}
            />
          ))}

          {/* Mesh nodes */}
          {MESH_NODES.map((node, i) => (
            <MeshNode
              key={`node-${i}`}
              x={node.x}
              y={node.y}
              size={(config.node / config.container) * 50}
              delay={i * 0.15}
              isCenter={i === 6}
            />
          ))}
        </g>

        {/* Outer scanning ring */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="rgb(16, 185, 129)"
          strokeWidth="0.5"
          opacity="0.2"
        >
          <animate
            attributeName="r"
            values="40;48;40"
            dur="3s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.3;0.1;0.3"
            dur="3s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      {message && (
        <div className="flex flex-col items-center gap-1">
          <p className={`${config.text} font-medium text-slate-200`}>
            {message}
          </p>
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}
      <span className="sr-only">{message || 'Loading'}</span>
    </div>
  );
}

// ============================================================================
// Compound Components
// ============================================================================

/**
 * Full-page loader with backdrop overlay.
 * Use for initial page loads or major async operations.
 */
export function FullPageLoader({ message = 'Connecting to mesh network...' }: FullPageLoaderProps): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Loading"
    >
      {/* Subtle background mesh grid */}
      <div className="absolute inset-0 opacity-[0.03]" aria-hidden="true">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1" fill="rgb(16, 185, 129)" />
              <path d="M 0 20 L 40 20 M 20 0 L 20 40" stroke="rgb(16, 185, 129)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative flex flex-col items-center gap-8">
        {/* Brand header */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xl font-bold tracking-widest text-emerald-400">
            REDMESH
          </span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        <Loader size="xl" message={message} />

        {/* Status line */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>Establishing secure connection</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline spinner for buttons and compact spaces.
 */
export function InlineLoader({ className = '' }: { className?: string }): JSX.Element {
  return (
    <span className={`inline-flex items-center ${className}`} role="status" aria-label="Loading">
      <svg
        className="h-4 w-4 animate-spin text-emerald-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="sr-only">Loading</span>
    </span>
  );
}

/**
 * Skeleton loader for card placeholders.
 */
export function CardSkeleton({ lines = 3 }: { lines?: number }): JSX.Element {
  return (
    <div
      className="rounded-xl border border-white/10 bg-slate-900/60 p-6"
      role="status"
      aria-label="Loading content"
    >
      <div className="animate-pulse space-y-4">
        <div className="h-5 w-1/3 rounded bg-slate-700/50" />
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-4 rounded bg-slate-700/30"
              style={{ width: `${Math.max(40, 100 - i * 20)}%` }}
            />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading content</span>
    </div>
  );
}

/**
 * Skeleton loader for job/task list items.
 * Matches the structure of JobList cards.
 */
export function JobListSkeleton({ count = 3 }: { count?: number }): JSX.Element {
  return (
    <div className="space-y-4" role="status" aria-label="Loading tasks">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-inner shadow-slate-950/40"
        >
          <div className="animate-pulse space-y-4">
            {/* Header: Title + badges */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-6 w-48 rounded bg-slate-700/50" />
              <div className="h-5 w-20 rounded-full bg-slate-700/40" />
              <div className="h-5 w-24 rounded-full bg-slate-700/30" />
              <div className="h-5 w-28 rounded-full bg-slate-700/30" />
            </div>

            {/* Summary text */}
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-slate-700/30" />
              <div className="h-4 w-3/4 rounded bg-slate-700/20" />
            </div>

            {/* Metadata row */}
            <div className="flex flex-wrap gap-4">
              <div className="h-3 w-32 rounded bg-slate-700/25" />
              <div className="h-3 w-24 rounded bg-slate-700/25" />
              <div className="h-3 w-28 rounded bg-slate-700/25" />
              <div className="h-3 w-36 rounded bg-slate-700/25" />
            </div>

            {/* Progress bar section */}
            <div className="flex flex-col gap-3 border-t border-white/10 pt-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="w-full max-w-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-20 rounded bg-slate-700/30" />
                  <div className="h-3 w-10 rounded bg-slate-700/30" />
                </div>
                <div className="h-2 w-full rounded-full bg-slate-700/20" />
              </div>
              <div className="flex gap-2 lg:self-end">
                <div className="h-8 w-24 rounded-lg bg-slate-700/30" />
              </div>
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Loading tasks</span>
    </div>
  );
}

/**
 * Skeleton for the dashboard stats cards.
 */
export function DashboardStatsSkeleton(): JSX.Element {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading statistics">
      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-5"
          >
            <div className="h-3 w-16 rounded bg-slate-700/40" />
            <div className="mt-3 h-8 w-12 rounded bg-slate-700/50" />
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3"
          >
            <div className="h-3 w-24 rounded bg-slate-700/30" />
            <div className="mt-2 h-7 w-10 rounded bg-slate-700/40" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading statistics</span>
    </div>
  );
}

export default memo(Loader);