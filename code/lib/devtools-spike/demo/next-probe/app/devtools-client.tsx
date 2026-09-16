'use client';

import { useEffect } from 'react';

/**
 * Minimal working injection surface for Next.js: the spike client entry is
 * dynamically imported from an effect so it (a) survives the package's
 * `sideEffects: false` elimination — a bare static import is dropped by both
 * Turbopack and webpack — and (b) executes browser-only, after hydration,
 * since the entry touches `document` at module scope and would crash SSR.
 */
export function DevtoolsClient() {
  useEffect(() => {
    void import('../../../src/client/entry.ts');
  }, []);

  return null;
}
