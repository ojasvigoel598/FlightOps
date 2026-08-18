// Reachable-URL resolution for the "Open on phone" QR workflow.
//
// A QR code is only useful if it encodes a URL another device can actually
// reach. This module deliberately rejects loopback-only addresses
// (localhost, 127.0.0.1, 0.0.0.0) and non-http(s) schemes, and it resolves the
// URL at RUNTIME from the environment the app is actually served from —
// never from a hard-coded host.

export interface ReachableUrlSources {
  /** window.location.origin on web (the deployed/preview origin) */
  origin?: string;
  /** Expo dev-server host URI (native development builds, e.g. "192.168.1.5:8081") */
  hostUri?: string;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

/** True when `url` is absolute, http(s), and not a loopback-only address. */
export function isValidReachableUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (LOOPBACK_HOSTS.has(host)) return false;
  return host.length > 0;
}

/**
 * Pick the best reachable URL from the runtime sources, in priority order:
 * 1. the web origin the app is currently served from,
 * 2. the Expo dev-server host URI (native dev builds).
 * Returns null when nothing reachable could be derived — callers must then
 * show guidance instead of an unusable QR code.
 */
export function resolveReachableUrl(sources: ReachableUrlSources): string | null {
  if (sources.origin && isValidReachableUrl(sources.origin)) {
    return sources.origin;
  }
  if (sources.hostUri && sources.hostUri.trim().length > 0) {
    const raw = sources.hostUri.trim();
    const candidate = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `http://${raw}`;
    if (isValidReachableUrl(candidate)) return candidate;
  }
  return null;
}
