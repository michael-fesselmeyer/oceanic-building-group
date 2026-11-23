// Adds the Cloudflare Web Analytics beacon once the page has finished loading.
//
// Written into the page as a plain deferred script, the browser fetched the beacon from
// Cloudflare's own domain while the page's opening photograph was still painting. On a slow
// phone connection, opening that second connection held back the Largest Contentful Paint by
// more than a second. Added after the `load` event (and after the browser is idle, where it can
// say so), the beacon no longer competes with the page. The cost: a visitor who leaves before
// the page finishes loading is not counted.
//
// Analytics.astro renders the holder element with the beacon's address and settings, so this
// module carries no build settings of its own.

export const BEACON_HOLDER_ID = 'cf-beacon';

interface LoaderWindow {
  addEventListener(type: 'load', listener: () => void, options: { once: true }): void;
  requestIdleCallback?: (callback: () => void, options: { timeout: number }) => unknown;
  setTimeout(callback: () => void, delay: number): unknown;
}

/** Adds the beacon script after the page has loaded. Does nothing without the holder element. */
export function loadBeaconAfterLoad(doc: Document = document, win: LoaderWindow = window): void {
  const holder = doc.getElementById(BEACON_HOLDER_ID);
  const src = holder?.dataset.src;
  const config = holder?.dataset.config;
  if (!src || !config) return;

  const add = () => {
    const script = doc.createElement('script');
    script.defer = true;
    script.src = src;
    script.dataset.cfBeacon = config;
    doc.body.append(script);
  };
  const whenIdle = () => {
    if (win.requestIdleCallback) win.requestIdleCallback(add, { timeout: 2000 });
    else win.setTimeout(add, 0);
  };

  if (doc.readyState === 'complete') whenIdle();
  else win.addEventListener('load', whenIdle, { once: true });
}
