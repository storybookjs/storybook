import type { ViteDevServer } from 'vite';

// Tiny pub/sub used by `before-environment-plugin` to hand the resolved
// `ViteDevServer` reference back to `preset.ts` without a circular import.
type Listener = (server: ViteDevServer) => void;

const listeners = new Set<Listener>();
let cached: ViteDevServer | null = null;

export function registerEnvApiServerHook(listener: Listener): void {
  if (cached) {
    listener(cached);
    return;
  }
  listeners.add(listener);
}

export function notifyEnvApiServerReady(server: ViteDevServer): void {
  cached = server;
  for (const l of listeners) {
    try {
      l(server);
    } catch {
      // listeners are addon-internal; swallow rather than abort other listeners
    }
  }
  listeners.clear();
}

/** Test-only: clear the cached reference and listeners. */
export function __resetServerReadyHookForTesting(): void {
  cached = null;
  listeners.clear();
}
