/**
 * Static-mode transport for service artifacts.
 *
 * Services do not configure this themselves. Instead, the architecture maintains a single
 * global transport, set once at application startup. In a Storybook static build, the manager
 * bundle calls `setStaticTransport(createBrowserStaticTransport())` during boot; in dev mode,
 * no transport is set and services skip the fetch entirely; in tests, the transport is swapped
 * for a Map-backed mock in `beforeEach`.
 *
 * The transport's `fetch(serviceId, filename)` receives the service id and the relative
 * filename. The path-to-URL mapping is the transport's responsibility — service authors only
 * declare the relative filename via their loader's `path` callback (or by accepting the
 * default `state.json` for the whole-state artifact).
 */
export interface ServiceStaticTransport {
  /**
   * Retrieve the parsed JSON artifact at `<serviceId>/<filename>` (relative to whatever
   * base URL the transport is configured with).
   *
   * Returning `null` is the explicit "no artifact present" signal — the runtime treats it
   * as a no-op and keeps in-memory defaults. Throwing propagates as a promise rejection on
   * the corresponding `store.ready`.
   */
  fetch(serviceId: string, filename: string): Promise<unknown | null>;
}

/**
 * The global transport. `null` means "no static loading happens" — services skip the fetch
 * during construction and resolve `ready` immediately. This is the right default for dev
 * mode and for tests that don't care about static artifacts.
 */
let currentTransport: ServiceStaticTransport | null = null;

/**
 * Install a static-mode transport. In production this is called once at app startup; in tests,
 * call it in `beforeEach` and pair with `clearStaticTransport` in `afterEach`.
 */
export function setStaticTransport(transport: ServiceStaticTransport): void {
  currentTransport = transport;
}

/** Remove the static-mode transport. Subsequent `registerService` calls will skip fetching. */
export function clearStaticTransport(): void {
  currentTransport = null;
}

/** @internal Used by `ServiceRuntime` to decide whether to fetch on construction. */
export function getStaticTransport(): ServiceStaticTransport | null {
  return currentTransport;
}

/**
 * Build a transport that fetches from `${baseUrl}/${serviceId}/${filename}` via `globalThis.fetch`.
 *
 * In a Storybook static-build deployment, this is the typical setup:
 *
 * ```ts
 * import { setStaticTransport, createBrowserStaticTransport } from 'storybook/internal/service';
 * setStaticTransport(createBrowserStaticTransport());
 * ```
 *
 * The default base URL is `/services`. Pass a different one for deployments where artifacts
 * are served from a non-standard path (e.g. behind a CDN prefix).
 *
 * If `globalThis.fetch` isn't available (Node without polyfill), every call resolves to null.
 * That makes this transport safe to install in any environment — non-browser hosts simply
 * see no artifacts.
 */
export function createBrowserStaticTransport(
  baseUrl: string = '/services'
): ServiceStaticTransport {
  const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return {
    fetch: async (serviceId, filename) => {
      const f = (globalThis as { fetch?: typeof fetch }).fetch;
      if (typeof f !== 'function') return null;
      const url = `${trimmedBase}/${serviceId}/${filename}`;
      const res = await f(url);
      if (!res.ok) return null;
      return res.json();
    },
  };
}
