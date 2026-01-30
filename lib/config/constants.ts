/**
 * Centralized application constants.
 * Keep version in version.ts for release automation compatibility.
 */

// =============================================================================
// Cache TTLs
// =============================================================================

/** Cache TTL for peer geo data (10 minutes) */
export const PEER_CACHE_TTL_MS = 10 * 60 * 1000;

// =============================================================================
// API Timeouts
// =============================================================================

/** Default timeout for API requests (30 seconds) */
export const DEFAULT_API_TIMEOUT_MS = 30_000;

/** Timeout for streaming API requests (2 minutes) */
export const STREAM_API_TIMEOUT_MS = 120_000;

// =============================================================================
// Address Formats
// =============================================================================

/** Prefix for internal Ratio1 node addresses */
export const INTERNAL_ADDRESS_PREFIX = '0xai_';