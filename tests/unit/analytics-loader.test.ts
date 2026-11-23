import { describe, expect, it, vi } from 'vitest';
import { BEACON_HOLDER_ID, loadBeaconAfterLoad } from '../../src/lib/analytics-loader';

const SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
const CONFIG = '{"token":"test-token-1"}';

/** A page with or without the holder element, at a given loading state. */
function fakePage(readyState: DocumentReadyState, holder = true) {
  const appended: { src: string; defer: boolean; dataset: Record<string, string> }[] = [];
  const doc = {
    readyState,
    getElementById: (id: string) =>
      holder && id === BEACON_HOLDER_ID ? { dataset: { src: SRC, config: CONFIG } } : null,
    createElement: () => ({ src: '', defer: false, dataset: {} as Record<string, string> }),
    body: { append: (node: (typeof appended)[number]) => appended.push(node) },
  } as unknown as Document;

  let onLoad: (() => void) | undefined;
  let idle: (() => void) | undefined;
  const win = {
    addEventListener: vi.fn((_type: 'load', listener: () => void) => {
      onLoad = listener;
    }),
    requestIdleCallback: vi.fn((callback: () => void) => {
      idle = callback;
    }),
    setTimeout: vi.fn(),
  };
  return { doc, win, appended, fireLoad: () => onLoad?.(), runIdle: () => idle?.() };
}

describe('loadBeaconAfterLoad', () => {
  it('waits for the load event and then for the browser to be idle', () => {
    const page = fakePage('loading');
    loadBeaconAfterLoad(page.doc, page.win);
    expect(page.appended).toHaveLength(0);

    page.fireLoad();
    expect(page.appended).toHaveLength(0);

    page.runIdle();
    expect(page.appended).toEqual([{ src: SRC, defer: true, dataset: { cfBeacon: CONFIG } }]);
  });

  it('adds the beacon straight away, when idle, if the page has already loaded', () => {
    const page = fakePage('complete');
    loadBeaconAfterLoad(page.doc, page.win);
    expect(page.win.addEventListener).not.toHaveBeenCalled();
    page.runIdle();
    expect(page.appended).toHaveLength(1);
  });

  it('falls back to a timer where the browser cannot report idle time', () => {
    const page = fakePage('complete');
    const win = { ...page.win, requestIdleCallback: undefined };
    loadBeaconAfterLoad(page.doc, win);
    expect(win.setTimeout).toHaveBeenCalledOnce();
  });

  it('does nothing on a page without the beacon', () => {
    const page = fakePage('loading', false);
    loadBeaconAfterLoad(page.doc, page.win);
    expect(page.win.addEventListener).not.toHaveBeenCalled();
    expect(page.appended).toHaveLength(0);
  });
});
