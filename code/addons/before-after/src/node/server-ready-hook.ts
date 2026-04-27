import type { ViteDevServer } from 'vite';

// Tiny pub/sub used by `before-environment-plugin` to hand the resolved
// `ViteDevServer` reference back to `preset.ts` without a circular import.
//
// Listeners and the cached server reference persist across `server.restart()`:
// `notifyEnvApiServerReady` updates `cached` and re-fires every listener;
// `resetServerReadyHookForServer(server)` clears the cache when that server's
// `httpServer` closes so late subscribers don't receive a stale reference.
type Listener = (server: ViteDevServer) => void;

const listeners = new Set<Listener>();
let cached: ViteDevServer | null = null;

export function registerEnvApiServerHook(listener: Listener): void {
  listeners.add(listener);
  if (cached) listener(cached);
}

export function unregisterEnvApiServerHook(listener: Listener): void {
  listeners.delete(listener);
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
}

/**
 * Drop the cached reference if (and only if) it points at `server`. Called by
 * the plugin's `httpServer.close` hook so a follow-up `createServer` does not
 * receive a stale ref before its own `configureServer` runs.
 */
export function resetServerReadyHookForServer(server: ViteDevServer): void {
  if (cached === server) cached = null;
}

/** Test-only: clear the cached reference and listeners. */
export function __resetServerReadyHookForTesting(): void {
  cached = null;
  listeners.clear();
}
