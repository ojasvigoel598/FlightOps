// QR-code URL validation: the payload must be a real, phone-reachable URL —
// never localhost/127.0.0.1/0.0.0.0, and never a hard-coded host.

import { describe, expect, it } from 'vitest';

import { isValidReachableUrl, resolveReachableUrl } from '@/services/reachable-url';

describe('isValidReachableUrl', () => {
  it('accepts real https/http hosts', () => {
    expect(isValidReachableUrl('https://flightops.example.com')).toBe(true);
    expect(isValidReachableUrl('http://192.168.1.20:8081')).toBe(true);
    expect(isValidReachableUrl('https://abc.preview.freebuff.dev')).toBe(true);
  });

  it('rejects loopback-only addresses (the QR-code anti-pattern)', () => {
    expect(isValidReachableUrl('http://localhost:8081')).toBe(false);
    expect(isValidReachableUrl('http://localhost')).toBe(false);
    expect(isValidReachableUrl('http://127.0.0.1:8081')).toBe(false);
    expect(isValidReachableUrl('http://0.0.0.0:8081')).toBe(false);
    expect(isValidReachableUrl('https://[::1]')).toBe(false);
  });

  it('rejects non-http schemes and garbage', () => {
    expect(isValidReachableUrl('file:///etc/passwd')).toBe(false);
    expect(isValidReachableUrl('javascript:alert(1)')).toBe(false);
    expect(isValidReachableUrl('not a url')).toBe(false);
    expect(isValidReachableUrl('')).toBe(false);
  });
});

describe('resolveReachableUrl', () => {
  it('prefers the live web origin over any hostUri', () => {
    expect(
      resolveReachableUrl({ origin: 'https://abc.preview.freebuff.dev', hostUri: '192.168.1.5:8081' }),
    ).toBe('https://abc.preview.freebuff.dev');
  });

  it('falls back to the Expo host URI with an http:// scheme', () => {
    expect(resolveReachableUrl({ hostUri: '192.168.1.5:8081' })).toBe('http://192.168.1.5:8081');
    expect(resolveReachableUrl({ hostUri: 'https://dev.example.com' })).toBe('https://dev.example.com');
  });

  it('returns null when only loopback addresses are available', () => {
    expect(resolveReachableUrl({ origin: 'http://localhost:8081' })).toBeNull();
    expect(resolveReachableUrl({ origin: 'http://127.0.0.1:8081', hostUri: 'localhost:8081' })).toBeNull();
    expect(resolveReachableUrl({})).toBeNull();
  });
});
