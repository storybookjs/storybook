import { describe, expect, it, vi } from 'vitest';

import { moduleInterceptionPlugin } from './module-interception.ts';

const MOCKS = {
  startMockPath: '/mocks/start.ts',
  startStorageContextMockPath: '/mocks/start-storage-context.ts',
  routerMockPath: '/mocks/react-router.ts',
};

function getHandler() {
  const plugin = moduleInterceptionPlugin(MOCKS);
  const resolveId = plugin.resolveId as any;
  return typeof resolveId === 'function' ? resolveId : resolveId.handler;
}

// Vite's resolver stamps a `?v=` query on the resolved id. The mock mirrors
// that so a raw path (the pre-fix behavior) is distinguishable from a properly
// delegated resolution.
function viteResolve() {
  return vi.fn(
    async (source: string): Promise<{ id: string } | null> => ({ id: `${source}?v=abc123` })
  );
}

async function resolveId(
  id: string,
  importer: string | undefined,
  resolve = viteResolve()
): Promise<{ result: unknown; resolve: ReturnType<typeof viteResolve> }> {
  const handler = getHandler();
  const result = await handler.call({ resolve }, id, importer);
  return { result, resolve };
}

describe('moduleInterceptionPlugin resolveId', () => {
  describe('router interception', () => {
    it('resolves the router mock through Vite instead of returning the raw path', async () => {
      const { result, resolve } = await resolveId('@tanstack/react-router', '/src/story.ts');

      expect(resolve).toHaveBeenCalledWith(MOCKS.routerMockPath, '/src/story.ts', {
        skipSelf: true,
      });
      expect((result as { id: string }).id).toBe('/mocks/react-router.ts?v=abc123');
    });

    it('intercepts router subpath imports', async () => {
      const { result } = await resolveId('@tanstack/react-router/ssr', '/src/story.ts');
      expect((result as { id: string }).id).toBe('/mocks/react-router.ts?v=abc123');
    });

    it('does not intercept when the importer is a mock (avoids a circular alias)', async () => {
      const { result, resolve } = await resolveId(
        '@tanstack/react-router',
        '/framework/src/export-mocks/react-router.ts'
      );
      expect(result).toBeNull();
      expect(resolve).not.toHaveBeenCalled();
    });

    it('does not intercept a bare router import with no importer', async () => {
      const { result } = await resolveId('@tanstack/react-router', undefined);
      expect(result).toBeNull();
    });
  });

  describe('start interception', () => {
    it.each([
      '@tanstack/react-start',
      '@tanstack/react-start/server',
      '@tanstack/react-start-server',
      '@tanstack/start-server-core',
    ])('resolves the start mock for %s', async (id) => {
      const { result, resolve } = await resolveId(id, '/src/story.ts');
      expect(resolve).toHaveBeenCalledWith(MOCKS.startMockPath, '/src/story.ts', {
        skipSelf: true,
      });
      expect((result as { id: string }).id).toBe('/mocks/start.ts?v=abc123');
    });

    it('resolves the storage-context mock', async () => {
      const { result } = await resolveId('@tanstack/start-storage-context', '/src/story.ts');
      expect((result as { id: string }).id).toBe('/mocks/start-storage-context.ts?v=abc123');
    });

    it.each(['virtual:cloudflare', 'server-entry', 'worker-entry'])(
      'resolves the start mock for intercepted pattern %s',
      async (pattern) => {
        const { result } = await resolveId(`some/${pattern}/thing`, '/src/story.ts');
        expect((result as { id: string }).id).toBe('/mocks/start.ts?v=abc123');
      }
    );
  });

  describe('fallbacks', () => {
    it('falls back to the raw mock path when Vite cannot resolve it', async () => {
      const resolve = vi.fn(async () => null);
      const { result } = await resolveId('@tanstack/react-router', '/src/story.ts', resolve);
      expect(result).toBe(MOCKS.routerMockPath);
    });

    it('returns null for unrelated ids', async () => {
      const { result, resolve } = await resolveId('react', '/src/story.ts');
      expect(result).toBeNull();
      expect(resolve).not.toHaveBeenCalled();
    });
  });
});
