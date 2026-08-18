// Progressive Web App wiring.
//
// The service worker only makes sense on the static web build (the deployed
// "web" output) — it is intentionally NOT registered in native builds or in
// the web dev server, where it would cache stale bundles and fight Metro HMR.
// Registration is also safe to fail: the app is fully functional without it.

/**
 * Inject PWA/installability head tags on web.
 *
 * The static export of this template does not serialize <head> content, so
 * the manifest link, theme color and mobile-web-app meta tags are added at
 * runtime instead. Idempotent: existing tags are updated, missing ones are
 * appended.
 */
export function setupWebHead(): void {
  if (typeof document === 'undefined') return;
  const head = document.head;
  if (!head) return;

  const title = head.querySelector('title');
  if (title && title.textContent?.trim().length === 0) {
    title.textContent = 'Flight Ops';
  }

  const setMeta = (name: string, content: string) => {
    let el = head.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      head.appendChild(el);
    }
    el.setAttribute('content', content);
  };
  setMeta('theme-color', '#060A12');
  setMeta('apple-mobile-web-app-capable', 'yes');
  setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');

  const addLink = (rel: string, href: string) => {
    if (head.querySelector(`link[rel="${rel}"]`)) return;
    const el = document.createElement('link');
    el.rel = rel;
    el.href = href;
    head.appendChild(el);
  };
  addLink('manifest', '/manifest.json');
  addLink('apple-touch-icon', '/icon.png');
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal: the app works fine without a service worker.
    });
  });
}
