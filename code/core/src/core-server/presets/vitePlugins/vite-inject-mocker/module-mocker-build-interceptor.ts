import type { MockedModule } from '@vitest/mocker';
import { MockerRegistry } from '@vitest/mocker';
import { http, passthrough } from 'msw';
import { setupWorker } from 'msw/browser';

interface Manifest {
  redirects: Record<string, string>;
  automocks: Record<string, string>;
}

/**
 * An interceptor for production builds. It uses a pre-generated manifest and MSW to intercept
 * module requests and serve mocked versions.
 */
export class ModuleMockerBuildInterceptor {
  // A registry for runtime mocks (e.g., `sb.mock('path', () => ({}))`)
  private mocks = new MockerRegistry();
  private manifestPromise: Promise<Manifest>;
  private worker: ReturnType<typeof setupWorker>;
  private globalThisAccessor: string;

  constructor(options: { globalThisAccessor: string }) {
    this.globalThisAccessor = options.globalThisAccessor;

    // Fetch the manifest created by our build plugin.
    this.manifestPromise = fetch('/mock-manifest.json').then((res) => {
      if (!res.ok) {
        console.error('[vitest-mocker] Failed to load mock-manifest.json. Mocks will not work.');
        return { redirects: {}, automocks: {} };
      }
      return res.json();
    });

    // Setup the MSW worker and start it.
    this.worker = setupWorker();
    this.configureHandlers();
    this.worker.start({
      // Start MSW without waiting for the service worker to be active.
      // This is crucial for intercepting the very first module imports.
      quiet: true,
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
  }

  /**
   * This is the core logic. It creates a single, dynamic MSW request handler that intercepts all
   * module requests.
   */
  private async configureHandlers() {
    await this.configureMockHandler();
  }

  private async configureMockHandler() {
    const manifest = await this.manifestPromise;

    const mockHandler = http.get(/.+/, async ({ request }) => {
      const url = new URL(request.url);
      const path = url.pathname;

      // Find a potential match in our manifest.
      // Note: This simple key lookup assumes the requested path matches the manifest key.
      // In a real-world scenario, you might need more robust logic to handle
      // different file extensions (.js vs .ts) or path variations.
      const manifestKey =
        Object.keys(manifest.redirects).find((k) => k.includes(path)) ||
        Object.keys(manifest.automocks).find((k) => k.includes(path));

      if (!manifestKey) {
        return passthrough();
      }

      // 1. Check the manifest for a pre-built automock.
      const automockUrl = manifest.automocks[manifestKey];
      if (automockUrl) {
        // Redirect the request to the pre-built, transformed asset.
        return Response.redirect(automockUrl, 307);
      }

      // 2. Check the manifest for a pre-built __mocks__ redirect.
      const redirectUrl = manifest.redirects[manifestKey];
      if (redirectUrl) {
        return Response.redirect(redirectUrl, 307);
      }

      // If no mock is found for this path, let the request pass through.
      return passthrough();
    });

    this.worker.use(mockHandler);
  }

  /**
   * Called by ModuleMocker when `sb.mock()` is executed. We just store the mock in our registry.
   * The dynamic MSW handler will pick it up on the next relevant network request. Currently, we
   * don't use this.mocks in any way. Mocks will be registered in the user's preview file and live
   * until the end. There is no way to invalidate or delete them.
   */
  public async register(module: MockedModule): Promise<void> {
    this.mocks.add(module);
  }

  public async delete(url: string): Promise<void> {
    this.mocks.delete(url);
  }

  public async invalidate(): Promise<void> {
    this.mocks.clear();
  }
}
