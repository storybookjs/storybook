import { type ServerHook, createServer } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import { withoutKitSsrMiddleware } from './without-kit-ssr-middleware.ts';

describe('withoutKitSsrMiddleware', () => {
  it.each(['function', 'object'] as const)(
    'runs the %s setup hook in the Vite context and omits its SSR callback',
    async (form) => {
      const installSsr = vi.fn();
      const setup = vi.fn<ServerHook>().mockResolvedValue(installSsr);
      const plugin = withoutKitSsrMiddleware({
        name: 'vite-plugin-sveltekit-setup',
        configureServer: form === 'function' ? setup : { order: 'pre', handler: setup },
      });
      const server = await createServer({
        configFile: false,
        server: { middlewareMode: true, watch: null, ws: false },
        optimizeDeps: { noDiscovery: true },
        plugins: [plugin],
      });
      try {
        expect(setup).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ middlewares: server.middlewares })
        );
        expect(setup.mock.contexts[0]).toMatchObject({ meta: { watchMode: true } });
        expect(installSsr).not.toHaveBeenCalled();
        if (form === 'object') {
          expect(plugin).toMatchObject({ configureServer: { order: 'pre' } });
        }
      } finally {
        await server.close();
      }
    }
  );

  it.each([
    { name: 'unrelated-plugin', configureServer: vi.fn() },
    { name: 'vite-plugin-sveltekit-setup' },
  ])('leaves $name unchanged', (plugin) => {
    expect(withoutKitSsrMiddleware(plugin)).toBe(plugin);
  });
});
