// Reachable-URL resolution for the "Open on phone" QR workflow.
//
// A QR code is only useful if it encodes a URL another device can actually
// reach. This module tries several strategies:
// 1. Use the web origin if it is not loopback.
// 2. Use the Expo dev-server host URI (native dev builds).
// 3. Attempt LAN IP detection via WebRTC (works when phone and computer
//    are on the same WiFi network).
// 4. Fall back to null — the caller then shows a manual URL input.

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
 * show guidance or a manual URL input.
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

/**
 * Attempt to detect the machine's LAN IP via WebRTC (free, no API key,
 * works when phone and computer are on the same WiFi). The trick: create
 * an RTCPeerConnection with a stun server, which forces the browser to
 * reveal the local IP in the ICE candidate. Returns null on failure.
 */
export function detectLanIp(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.createDataChannel('x');
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) { resolved = true; pc.close(); resolve(null); }
      }, 3000);
      pc.onicecandidate = (e) => {
        if (resolved || !e.candidate?.candidate) return;
        const m = e.candidate.candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        if (m && !LOOPBACK_HOSTS.has(m[1]) && !m[1].startsWith('169.')) {
          resolved = true;
          clearTimeout(timeout);
          pc.close();
          resolve(m[1]);
        }
      };
      pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => {
        if (!resolved) { resolved = true; clearTimeout(timeout); resolve(null); }
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Build a full reachable URL from a detected LAN IP and the current port.
 * Uses the port from window.location (typically 8081 for Expo web).
 */
export function buildLanUrl(ip: string): string {
  const port = typeof window !== 'undefined' ? window.location.port : '8081';
  return `http://${ip}${port ? ':' + port : ''}`;
}
