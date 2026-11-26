import { logger } from 'storybook/internal/node-logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompositionAuth, extractBearerToken } from './composition-auth.ts';

const VALID_MANIFEST =
  '{"v":1,"components":{"button":{"id":"button","name":"Button","path":"src/Button.tsx"}}}';

type Route = (init?: RequestInit) => Response | Promise<Response>;

// Answers by URL (`POST <url>` for posts); unknown URLs answer 404.
function routeFetch(routes: Record<string, Route>) {
  return vi.fn(async (input: string, init?: RequestInit) => {
    const route = (init?.method === 'POST' && routes[`POST ${input}`]) || routes[input];
    return route ? route(init) : new Response('Not found', { status: 404 });
  });
}

// Reads every remote ref, which re-checks the unreachable ones that are due
async function readAllRefs(auth: CompositionAuth) {
  const provider = auth.createManifestProvider('http://localhost:6006');
  const remotes = auth.buildSources().filter((source) => source.url);
  await Promise.allSettled(
    remotes.map((source) => provider(undefined, './manifests/components.json', source))
  );
}

function oauthChallenge(resourceMetadataUrl: string) {
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"` },
  });
}

function resourceMetadata(resource: string, authServer: string) {
  return { resource, authorization_servers: [authServer] };
}

function serverMetadata(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
  };
}

function privateRefRoutes(
  refUrl: string,
  authServer = 'https://auth.example.com'
): Record<string, Route> {
  return {
    [`${refUrl}/manifests/components.json`]: () =>
      oauthChallenge(`${refUrl}/.well-known/oauth-protected-resource`),
    [`${refUrl}/.well-known/oauth-protected-resource`]: () =>
      Response.json(resourceMetadata(`${refUrl}/mcp`, authServer)),
    [`${authServer}/.well-known/oauth-authorization-server`]: () =>
      Response.json(serverMetadata(authServer)),
  };
}

describe('CompositionAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('extractBearerToken', () => {
    it('extracts token from valid Bearer header', () => {
      expect(extractBearerToken('Bearer abc123')).toBe('abc123');
    });

    it('returns null for non-Bearer header', () => {
      expect(extractBearerToken('Basic abc123')).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(extractBearerToken(undefined)).toBeNull();
    });

    it('returns null for null', () => {
      expect(extractBearerToken(null)).toBeNull();
    });

    it('extracts token from array header', () => {
      expect(extractBearerToken(['Bearer abc'])).toBe('abc');
    });

    it('finds Bearer in mixed array', () => {
      expect(extractBearerToken(['Basic xyz', 'Bearer abc'])).toBe('abc');
    });

    it('returns null for array without Bearer', () => {
      expect(extractBearerToken(['Basic xyz'])).toBeNull();
    });
  });

  describe('requiresAuth', () => {
    it('returns false when no refs initialized', () => {
      const auth = new CompositionAuth();
      expect(auth.requiresAuth).toBe(false);
    });
  });

  describe('buildWellKnown', () => {
    it('returns null when no auth requirement', () => {
      const auth = new CompositionAuth();
      expect(auth.buildWellKnown('http://localhost:6006')).toBeNull();
    });
  });

  describe('buildWwwAuthenticate', () => {
    it('builds correct header', () => {
      const auth = new CompositionAuth();
      const header = auth.buildWwwAuthenticate('http://localhost:6006');
      expect(header).toContain('Bearer');
      expect(header).toContain('resource_metadata=');
      expect(header).toContain('http://localhost:6006/.well-known/oauth-protected-resource');
    });
  });

  describe('buildSources', () => {
    it('creates sources array with local first', async () => {
      const auth = new CompositionAuth();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              '{"v":1,"components":{"button":{"id":"button","name":"Button","path":"src/Button.tsx"}}}'
            ),
        })
      );

      await auth.initialize([
        { id: 'design-system', title: 'Design System', url: 'http://ds.example.com' },
      ]);
      const sources = auth.buildSources();

      expect(sources).toEqual([
        { id: 'local', title: 'Local' },
        { id: 'design-system', title: 'Design System', url: 'http://ds.example.com' },
      ]);
    });

    it('handles multiple refs', async () => {
      const auth = new CompositionAuth();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              '{"v":1,"components":{"button":{"id":"button","name":"Button","path":"src/Button.tsx"}}}'
            ),
        })
      );

      await auth.initialize([
        { id: 'ref-a', title: 'Ref A', url: 'http://a.example.com' },
        { id: 'ref-b', title: 'Ref B', url: 'http://b.example.com' },
      ]);
      const sources = auth.buildSources();

      expect(sources).toHaveLength(3);
      expect(sources.map((s) => s.id)).toEqual(['local', 'ref-a', 'ref-b']);
    });

    it('excludes refs without manifests', async () => {
      const auth = new CompositionAuth();
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          // ref-a: valid manifest
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () =>
              Promise.resolve(
                '{"v":1,"components":{"button":{"id":"button","name":"Button","path":"src/Button.tsx"}}}'
              ),
          })
          // ref-b: 404 (no manifest)
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
          })
          // ref-b fallback: /mcp returns 200 (no auth either)
          .mockResolvedValueOnce({
            status: 200,
          })
      );

      await auth.initialize([
        { id: 'ref-a', title: 'Ref A', url: 'http://a.example.com' },
        { id: 'ref-b', title: 'Ref B', url: 'http://b.example.com' },
      ]);
      const sources = auth.buildSources();

      expect(sources).toHaveLength(2);
      expect(sources.map((s) => s.id)).toEqual(['local', 'ref-a']);
    });
  });

  describe('createManifestProvider', () => {
    it('creates a manifest provider function', () => {
      const auth = new CompositionAuth();
      const provider = auth.createManifestProvider('http://localhost:6006');
      expect(typeof provider).toBe('function');
    });

    it('fetches from local origin when no source provided', async () => {
      const auth = new CompositionAuth();

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"v":1,"components":{}}'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp');

      await provider(request, './manifests/components.json');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:6006/manifests/components.json',
        expect.any(Object)
      );
    });

    it('fetches from source URL when source provided', async () => {
      const auth = new CompositionAuth();

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"v":1,"components":{}}'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp');
      const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

      await provider(request, './manifests/components.json', source);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://remote.example.com/manifests/components.json',
        expect.any(Object)
      );
    });

    it('only rewrites a leading ./ in the manifest path, leaving inner ./ sequences intact', async () => {
      const auth = new CompositionAuth();

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"anything":"goes"}'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp');
      const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

      await provider(request, '/services/a./b.json', source);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://remote.example.com/services/a./b.json',
        expect.any(Object)
      );
    });

    it('extracts token from request headers for auth-required sources', async () => {
      const auth = new CompositionAuth();

      // Initialize with a ref that requires auth (401 → resource metadata → server metadata)
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 401,
            headers: new Headers({
              'WWW-Authenticate':
                'Bearer resource_metadata="http://remote.example.com/.well-known/oauth-protected-resource"',
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                resource: 'http://remote.example.com/mcp',
                authorization_servers: ['http://auth.example.com'],
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                issuer: 'http://auth.example.com',
                authorization_endpoint: 'http://auth.example.com/authorize',
                token_endpoint: 'http://auth.example.com/token',
              }),
          })
      );

      await auth.initialize([{ id: 'remote', title: 'Remote', url: 'http://remote.example.com' }]);

      // Now set up mock for manifest fetching
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"v":1,"components":{}}'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = auth.createManifestProvider('http://localhost:6006');

      const request = new Request('http://localhost:6006/mcp', {
        headers: { Authorization: 'Bearer test-token-123' },
      });
      const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

      await provider(request, './manifests/components.json', source);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://remote.example.com/manifests/components.json',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });
  });

  describe('fetchManifest (via createManifestProvider)', () => {
    it('returns manifest content when response is valid', async () => {
      const auth = new CompositionAuth();
      const manifestJson =
        '{"v":1,"components":{"button":{"id":"button","path":"src/Button.tsx","name":"Button"}}}';

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(manifestJson),
        })
      );

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp');

      const result = await provider(request, './manifests/components.json');
      expect(result).toBe(manifestJson);
    });

    it('returns split/ref service payloads from a remote source (v1)', async () => {
      const auth = new CompositionAuth();
      // A `core/story-docs` service file: `stories` is a record keyed by story id, which
      // does NOT match the top-level component-manifest shape. The provider must return it
      // verbatim rather than rejecting it as an "invalid manifest".
      const storyDocsJson = JSON.stringify({
        components: {
          button: {
            id: 'button',
            name: 'Button',
            path: 'src/Button.tsx',
            stories: {
              'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
            },
          },
        },
      });

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(storyDocsJson),
        })
      );

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp');
      const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

      const result = await provider(request, './services/core/story-docs/button.json', source);
      expect(result).toBe(storyDocsJson);
    });

    it('rejects a remote service payload that is not valid JSON', async () => {
      const auth = new CompositionAuth();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          // HTML login page masquerading as a 200 — not JSON.
          text: () => Promise.resolve('<!doctype html><html><body>Login</body></html>'),
        })
      );

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp');
      const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

      await expect(
        provider(request, './services/core/story-docs/button.json', source)
      ).rejects.toThrow(/Invalid manifest response|Authorization/);
    });

    it('throws when fetch returns non-ok response', async () => {
      const auth = new CompositionAuth();

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
        })
      );

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp');
      const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

      await expect(provider(request, './manifests/components.json', source)).rejects.toThrow(
        'Failed to fetch'
      );
    });

    it('throws auth error when remote returns 401 directly', async () => {
      const auth = new CompositionAuth();

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
        })
      );

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp', {
        headers: { Authorization: 'Bearer expired-token' },
      });
      const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

      await expect(provider(request, './manifests/components.json', source)).rejects.toThrow(
        'Authentication failed'
      );
    });

    it('throws auth error when response is invalid manifest and /mcp returns 401', async () => {
      const auth = new CompositionAuth();

      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          // First call: manifest fetch returns 200 with unexpected JSON
          .mockResolvedValueOnce({
            ok: true,
            text: () => Promise.resolve('{"some":"unexpected"}'),
          })
          // Second call: /mcp returns 401
          .mockResolvedValueOnce({
            status: 401,
          })
      );

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp', {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

      await expect(provider(request, './manifests/components.json', source)).rejects.toThrow(
        'Authentication failed'
      );
    });

    it('throws when response is invalid manifest and /mcp does not return 401', async () => {
      const auth = new CompositionAuth();

      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          // First call: manifest fetch returns 200 with unexpected JSON
          .mockResolvedValueOnce({
            ok: true,
            text: () => Promise.resolve('{"some":"unexpected"}'),
          })
          // Second call: /mcp returns 200 (no auth issue)
          .mockResolvedValueOnce({
            status: 200,
          })
      );

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp');
      const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

      await expect(provider(request, './manifests/components.json', source)).rejects.toThrow(
        'Invalid manifest response'
      );
    });

    it('caches remote manifest responses and revalidates in background', async () => {
      const auth = new CompositionAuth();
      const manifestJson =
        '{"v":1,"components":{"button":{"id":"button","path":"src/Button.tsx","name":"Button"}}}';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(manifestJson),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp', {
        headers: { Authorization: 'Bearer token' },
      });
      const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

      // First call — fetches (blocking)
      await provider(request, './manifests/components.json', source);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call — served from cache, triggers background revalidation
      const result = await provider(request, './manifests/components.json', source);
      expect(result).toBe(manifestJson);
      expect(mockFetch).toHaveBeenCalledTimes(2); // background fetch started
    });

    it('fetches fresh when cache is expired', async () => {
      vi.useFakeTimers();
      const auth = new CompositionAuth();
      const oldManifest =
        '{"v":1,"components":{"button":{"id":"button","path":"src/Button.tsx","name":"Button"}}}';
      const newManifest =
        '{"v":1,"components":{"button":{"id":"button","path":"src/Button.tsx","name":"Button","description":"updated"}}}';

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(oldManifest) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(newManifest) });
      vi.stubGlobal('fetch', mockFetch);

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp', {
        headers: { Authorization: 'Bearer token' },
      });
      const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

      // First call — fetches and caches
      const first = await provider(request, './manifests/components.json', source);
      expect(first).toBe(oldManifest);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time past cache TTL (61 minutes)
      vi.advanceTimersByTime(61 * 60 * 1000);

      // Second call — cache expired, fetches fresh (blocking)
      const second = await provider(request, './manifests/components.json', source);
      expect(second).toBe(newManifest);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('does not cache local manifest responses', async () => {
      const auth = new CompositionAuth();
      const manifestJson =
        '{"v":1,"components":{"button":{"id":"button","path":"src/Button.tsx","name":"Button"}}}';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(manifestJson),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp');

      // No source = local
      await provider(request, './manifests/components.json');
      await provider(request, './manifests/components.json');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not cache error responses', async () => {
      const auth = new CompositionAuth();
      const manifestJson =
        '{"v":1,"components":{"button":{"id":"button","path":"src/Button.tsx","name":"Button"}}}';

      const mockFetch = vi
        .fn()
        // First call: fails
        .mockResolvedValueOnce({ ok: false, status: 500 })
        // Second call: succeeds
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(manifestJson),
        });
      vi.stubGlobal('fetch', mockFetch);

      const provider = auth.createManifestProvider('http://localhost:6006');
      const request = new Request('http://localhost:6006/mcp', {
        headers: { Authorization: 'Bearer token' },
      });
      const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

      // First call fails — should not cache
      await expect(provider(request, './manifests/components.json', source)).rejects.toThrow();

      // Second call should fetch again (not cached)
      const result = await provider(request, './manifests/components.json', source);
      expect(result).toBe(manifestJson);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('initialize', () => {
    it('detects public refs when manifest returns valid content', async () => {
      const auth = new CompositionAuth();

      // Mock: manifest returns valid manifest JSON
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              '{"v":1,"components":{"button":{"id":"button","name":"Button","path":"src/Button.tsx"}}}'
            ),
        })
      );

      await auth.initialize([{ id: 'public', title: 'public', url: 'http://public.example.com' }]);

      expect(auth.requiresAuth).toBe(false);
      expect(auth.authUrls).toHaveLength(0);
    });

    it('detects private refs via manifest 401 response', async () => {
      const auth = new CompositionAuth();

      // Mock: manifest returns 401, then resource + server metadata
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 401,
            headers: new Headers({
              'WWW-Authenticate':
                'Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                resource: 'https://example.com/mcp',
                authorization_servers: ['https://auth.example.com'],
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                issuer: 'https://auth.example.com',
                authorization_endpoint: 'https://auth.example.com/authorize',
                token_endpoint: 'https://auth.example.com/token',
              }),
          })
      );

      await auth.initialize([
        { id: 'private', title: 'private', url: 'https://private.example.com' },
      ]);

      expect(auth.requiresAuth).toBe(true);
      expect(auth.authUrls).toContain('https://private.example.com');

      const wellKnown = auth.buildWellKnown('http://localhost:6006/mcp');
      expect(wellKnown).toEqual({
        resource: 'http://localhost:6006/mcp',
        authorization_servers: ['https://auth.example.com'],
        scopes_supported: undefined,
      });
    });

    it('falls back to /mcp when manifest returns unexpected JSON', async () => {
      const auth = new CompositionAuth();

      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          // manifest returns 200 with unexpected JSON (not a valid manifest)
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve('{"some":"unexpected","response":true}'),
          })
          // /mcp returns 401
          .mockResolvedValueOnce({
            status: 401,
            headers: new Headers({
              'WWW-Authenticate':
                'Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
            }),
          })
          // resource metadata
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                resource: 'https://example.com/mcp',
                authorization_servers: ['https://auth.example.com'],
              }),
          })
          // server metadata
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                issuer: 'https://auth.example.com',
                authorization_endpoint: 'https://auth.example.com/authorize',
                token_endpoint: 'https://auth.example.com/token',
              }),
          })
      );

      await auth.initialize([
        { id: 'private', title: 'private', url: 'https://private.example.com' },
      ]);

      expect(auth.requiresAuth).toBe(true);
    });

    it('falls back to /mcp when manifest returns non-JSON', async () => {
      const auth = new CompositionAuth();

      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          // manifest returns 200 with HTML (not JSON)
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve('<html>Login page</html>'),
          })
          // /mcp returns 401
          .mockResolvedValueOnce({
            status: 401,
            headers: new Headers({
              'WWW-Authenticate':
                'Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                resource: 'https://example.com/mcp',
                authorization_servers: ['https://auth.example.com'],
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                issuer: 'https://auth.example.com',
                authorization_endpoint: 'https://auth.example.com/authorize',
                token_endpoint: 'https://auth.example.com/token',
              }),
          })
      );

      await auth.initialize([
        { id: 'private', title: 'private', url: 'https://private.example.com' },
      ]);

      expect(auth.requiresAuth).toBe(true);
    });

    it('keeps config-order OAuth selection when a later ref finishes first', async () => {
      const auth = new CompositionAuth();
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      let releaseFirst!: (response: Response) => void;
      const fetchMock = routeFetch({
        'https://private.chromatic.com/manifests/components.json': () =>
          new Promise<Response>((resolve) => (releaseFirst = resolve)),
        'https://chromatic.com/.well-known/oauth-protected-resource': () =>
          Response.json(resourceMetadata('https://chromatic.com/mcp', 'https://www.chromatic.com')),
        'https://www.chromatic.com/.well-known/oauth-authorization-server': () =>
          Response.json(serverMetadata('https://www.chromatic.com')),
        'https://other.example.com/manifests/components.json': () =>
          oauthChallenge('https://other.example.com/.well-known/oauth-protected-resource'),
        'https://other.example.com/.well-known/oauth-protected-resource': () =>
          Response.json(
            resourceMetadata('https://other.example.com/mcp', 'https://other.example.com')
          ),
        'https://other.example.com/.well-known/oauth-authorization-server': () =>
          Response.json(serverMetadata('https://other.example.com')),
      });
      vi.stubGlobal('fetch', fetchMock);

      const pending = auth.initialize([
        { id: 'chromatic', title: 'Chromatic', url: 'https://private.chromatic.com' },
        { id: 'other', title: 'Other', url: 'https://other.example.com' },
      ]);

      await vi.waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          'https://other.example.com/.well-known/oauth-authorization-server',
          expect.anything()
        )
      );
      releaseFirst(oauthChallenge('https://chromatic.com/.well-known/oauth-protected-resource'));
      await pending;

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /"Other" uses a different OAuth server.*https:\/\/www\.chromatic\.com/
        )
      );
      expect(auth.buildWellKnown('http://localhost:6006/mcp')).toMatchObject({
        authorization_servers: ['https://www.chromatic.com'],
      });
    });

    it('keeps a ref unreachable when its OAuth metadata endpoint times out', async () => {
      const auth = new CompositionAuth();
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) =>
          url.endsWith('/manifests/components.json')
            ? Promise.resolve({
                ok: false,
                status: 401,
                headers: new Headers({
                  'WWW-Authenticate':
                    'Bearer resource_metadata="https://stalled.example.com/.well-known/oauth-protected-resource"',
                }),
              })
            : new Promise((_resolve, reject) =>
                init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
              )
        )
      );
      // Fake timers do not drive `AbortSignal.timeout`, so the signal it returns is stubbed and
      // aborted by hand, which also pins the budget it was created with.
      const controller = new AbortController();
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
      const pending = auth.initialize([
        { id: 'stalled', title: 'Stalled', url: 'https://stalled.example.com' },
      ]);
      // Abort once the metadata fetch is listening for it
      await vi.waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(
          'https://stalled.example.com/.well-known/oauth-protected-resource',
          expect.anything()
        )
      );
      expect(timeoutSpy).toHaveBeenCalledWith(30_000);
      controller.abort(new DOMException('timed out', 'TimeoutError'));
      await pending;

      expect(auth.requiresAuth).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/"Stalled".*could not be reached.*checked again/)
      );
    });

    it('keeps an unreachable ref listed and says it will be checked again', async () => {
      const auth = new CompositionAuth();
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error: ECONNREFUSED')));

      await auth.initialize([
        { id: 'down', title: 'Down Service', url: 'http://unreachable.example.com' },
      ]);

      expect(auth.requiresAuth).toBe(false);
      expect(auth.authUrls).toHaveLength(0);
      expect(auth.buildSources().map((source) => source.id)).toEqual(['local', 'down']);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/"Down Service".*could not be reached.*ECONNREFUSED.*checked again/)
      );
    });

    it('warns when OAuth resource metadata fetch fails', async () => {
      const auth = new CompositionAuth();
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          // manifest returns 401
          .mockResolvedValueOnce({
            ok: false,
            status: 401,
            headers: new Headers({
              'WWW-Authenticate':
                'Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
            }),
          })
          // resource metadata is missing
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
          })
      );

      await auth.initialize([{ id: 'broken', title: 'Broken', url: 'https://broken.example.com' }]);

      expect(auth.requiresAuth).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch OAuth resource metadata')
      );
    });

    it('warns when OAuth server metadata fetch fails', async () => {
      const auth = new CompositionAuth();
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          // manifest returns 401
          .mockResolvedValueOnce({
            ok: false,
            status: 401,
            headers: new Headers({
              'WWW-Authenticate':
                'Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
            }),
          })
          // resource metadata succeeds
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                resource: 'https://example.com/mcp',
                authorization_servers: ['https://auth.example.com'],
              }),
          })
          // server metadata is missing
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
          })
      );

      await auth.initialize([{ id: 'broken', title: 'Broken', url: 'https://broken.example.com' }]);

      expect(auth.requiresAuth).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch OAuth server metadata')
      );
    });
  });

  describe('refs that are briefly unavailable', () => {
    const PRIVATE_REF = { id: 'private', title: 'Private', url: 'https://private.example.com' };
    const PUBLIC_REF = { id: 'public', title: 'Public', url: 'https://public.example.com' };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(logger, 'warn').mockImplementation(() => {});
      vi.spyOn(logger, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('accepts a large manifest that takes several seconds to arrive', async () => {
      const auth = new CompositionAuth();
      // Node's `AbortSignal.timeout` ignores fake timers, so swap in one that follows them.
      vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(new DOMException('timed out', 'TimeoutError')), ms);
        return controller.signal;
      });
      vi.stubGlobal(
        'fetch',
        routeFetch({
          [`${PUBLIC_REF.url}/manifests/components.json`]: (init) =>
            new Promise((resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
              setTimeout(() => resolve(new Response(VALID_MANIFEST)), 8_000);
            }),
        })
      );

      const pending = auth.initialize([PUBLIC_REF]);
      await vi.advanceTimersByTimeAsync(8_000);
      await pending;

      expect(logger.warn).not.toHaveBeenCalled();
      expect(auth.buildSources().map((source) => source.id)).toEqual(['local', 'public']);
    });

    it('picks up the OAuth flow of a private ref that was down at boot', async () => {
      const auth = new CompositionAuth();
      const routes = privateRefRoutes(PRIVATE_REF.url);
      const manifest = routes[`${PRIVATE_REF.url}/manifests/components.json`];
      let down = true;
      routes[`${PRIVATE_REF.url}/manifests/components.json`] = (init) => {
        if (down) throw new TypeError('fetch failed');
        return manifest(init);
      };
      vi.stubGlobal('fetch', routeFetch(routes));

      await auth.initialize([PRIVATE_REF]);
      expect(auth.requiresAuth).toBe(false);
      expect(auth.buildSources().map((source) => source.id)).toEqual(['local', 'private']);

      down = false;
      await vi.advanceTimersByTimeAsync(5_000);
      await readAllRefs(auth);

      expect(auth.requiresAuth).toBe(true);
      expect(auth.authUrls).toEqual([PRIVATE_REF.url]);
      expect(auth.buildWellKnown('http://localhost:6006/mcp')).toMatchObject({
        authorization_servers: ['https://auth.example.com'],
      });
      expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/"Private".*reachable again/));
    });

    it('treats a 5xx from the manifest as a passing outage, not as a private or missing ref', async () => {
      const auth = new CompositionAuth();
      let status = 502;
      const mockFetch = routeFetch({
        [`${PUBLIC_REF.url}/manifests/components.json`]: () =>
          status === 200
            ? new Response(VALID_MANIFEST, { headers: { 'content-type': 'application/json' } })
            : new Response('Bad gateway', { status }),
        // A public Storybook's /mcp may still demand auth; the outage must not be read as that.
        [`POST ${PUBLIC_REF.url}/mcp`]: () =>
          oauthChallenge(`${PUBLIC_REF.url}/.well-known/oauth-protected-resource`),
      });
      vi.stubGlobal('fetch', mockFetch);

      await auth.initialize([PUBLIC_REF]);
      expect(auth.requiresAuth).toBe(false);
      expect(mockFetch).not.toHaveBeenCalledWith(`${PUBLIC_REF.url}/mcp`, expect.anything());

      status = 200;
      await vi.advanceTimersByTimeAsync(5_000);
      await readAllRefs(auth);

      expect(auth.requiresAuth).toBe(false);
      expect(auth.buildSources().map((source) => source.id)).toEqual(['local', 'public']);
    });

    it('treats a 5xx from the OAuth metadata as a passing outage', async () => {
      const auth = new CompositionAuth();
      const routes = privateRefRoutes(PRIVATE_REF.url);
      const metadata = routes['https://auth.example.com/.well-known/oauth-authorization-server'];
      let down = true;
      routes['https://auth.example.com/.well-known/oauth-authorization-server'] = (init) =>
        down ? new Response('Unavailable', { status: 503 }) : metadata(init);
      vi.stubGlobal('fetch', routeFetch(routes));

      await auth.initialize([PRIVATE_REF]);
      expect(auth.requiresAuth).toBe(false);
      expect(auth.buildSources().map((source) => source.id)).toEqual(['local', 'private']);

      down = false;
      await vi.advanceTimersByTimeAsync(5_000);
      await readAllRefs(auth);

      expect(auth.requiresAuth).toBe(true);
    });

    it('waits longer after each failure before checking again', async () => {
      const auth = new CompositionAuth();
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
      vi.stubGlobal('fetch', mockFetch);

      await auth.initialize([PUBLIC_REF]);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(4_999);
      await readAllRefs(auth);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await readAllRefs(auth);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(9_999);
      await readAllRefs(auth);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1);
      await readAllRefs(auth);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      await vi.advanceTimersByTimeAsync(20_000);
      await readAllRefs(auth);
      await vi.advanceTimersByTimeAsync(40_000);
      await readAllRefs(auth);
      expect(mockFetch).toHaveBeenCalledTimes(5);

      // The fifth failure would wait 80s; the delay stops at 60s
      for (const expected of [6, 7]) {
        await vi.advanceTimersByTimeAsync(59_999);
        await readAllRefs(auth);
        expect(mockFetch).toHaveBeenCalledTimes(expected - 1);
        await vi.advanceTimersByTimeAsync(1);
        await readAllRefs(auth);
        expect(mockFetch).toHaveBeenCalledTimes(expected);
      }
      // Warned once, not on every failed retry.
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
    it('fails fast for a ref waiting for a re-check, then fetches it again once it recovers', async () => {
      const auth = new CompositionAuth();
      let down = true;
      const mockFetch = routeFetch({
        [`${PUBLIC_REF.url}/manifests/components.json`]: () => {
          if (down) throw new TypeError('fetch failed');
          return new Response(VALID_MANIFEST);
        },
      });
      vi.stubGlobal('fetch', mockFetch);
      await auth.initialize([PUBLIC_REF]);
      const provider = auth.createManifestProvider('http://localhost:6006');
      const source = auth.buildSources().find((s) => s.id === 'public');
      mockFetch.mockClear();

      await expect(provider(undefined, './manifests/components.json', source)).rejects.toThrow(
        /"Public" is temporarily unreachable/
      );
      expect(mockFetch).not.toHaveBeenCalled();

      down = false;
      await vi.advanceTimersByTimeAsync(5_000);
      await readAllRefs(auth);

      await expect(provider(undefined, './manifests/components.json', source)).resolves.toBe(
        VALID_MANIFEST
      );
    });

    it('re-checks a due ref when its manifest is read', async () => {
      const auth = new CompositionAuth();
      let down = true;
      vi.stubGlobal(
        'fetch',
        routeFetch({
          [`${PUBLIC_REF.url}/manifests/components.json`]: () => {
            if (down) throw new TypeError('fetch failed');
            return new Response(VALID_MANIFEST);
          },
        })
      );
      await auth.initialize([PUBLIC_REF]);
      const provider = auth.createManifestProvider('http://localhost:6006');
      const source = auth.buildSources().find((s) => s.id === 'public');

      down = false;
      await vi.advanceTimersByTimeAsync(5_000);

      await expect(provider(undefined, './manifests/components.json', source)).resolves.toBe(
        VALID_MANIFEST
      );
    });

    it('flags an auth error on the request when a private ref recovers as its manifest is read', async () => {
      const auth = new CompositionAuth();
      const routes = privateRefRoutes(PRIVATE_REF.url);
      const challenge = routes[`${PRIVATE_REF.url}/manifests/components.json`];
      let down = true;
      routes[`${PRIVATE_REF.url}/manifests/components.json`] = (init) => {
        if (down) throw new TypeError('fetch failed');
        return challenge(init);
      };
      vi.stubGlobal('fetch', routeFetch(routes));
      await auth.initialize([PRIVATE_REF]);
      const provider = auth.createManifestProvider('http://localhost:6006');
      const source = auth.buildSources().find((s) => s.id === 'private');
      const request = new Request('http://localhost:6006/mcp');

      down = false;
      await vi.advanceTimersByTimeAsync(5_000);

      await expect(provider(request, './manifests/components.json', source)).rejects.toThrow(
        /Authentication failed/
      );
      expect(auth.hadAuthError(request)).toBe(true);
    });

    it('contains an error thrown while applying a re-check', async () => {
      const auth = new CompositionAuth();
      let down = true;
      vi.stubGlobal(
        'fetch',
        routeFetch({
          [`${PUBLIC_REF.url}/manifests/components.json`]: () => {
            if (down) throw new TypeError('fetch failed');
            return new Response(VALID_MANIFEST);
          },
        })
      );
      await auth.initialize([PUBLIC_REF]);
      const provider = auth.createManifestProvider('http://localhost:6006');
      const source = auth.buildSources().find((s) => s.id === 'public');
      vi.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('logger broke');
      });

      down = false;
      await vi.advanceTimersByTimeAsync(5_000);

      await expect(provider(undefined, './manifests/components.json', source)).rejects.toThrow(
        /"Public" is temporarily unreachable/
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Checking composed ref "Public" failed: logger broke')
      );
    });

    it('shares one re-check between concurrent reads of a ref', async () => {
      const auth = new CompositionAuth();
      let hang = false;
      const mockFetch = routeFetch({
        [`${PUBLIC_REF.url}/manifests/components.json`]: () => {
          if (hang) return new Promise<Response>(() => {});
          throw new TypeError('fetch failed');
        },
      });
      vi.stubGlobal('fetch', mockFetch);
      await auth.initialize([PUBLIC_REF]);
      const provider = auth.createManifestProvider('http://localhost:6006');
      const source = auth.buildSources().find((s) => s.id === 'public');

      hang = true;
      await vi.advanceTimersByTimeAsync(5_000);
      mockFetch.mockClear();
      const reads = Promise.allSettled([
        provider(undefined, './manifests/components.json', source),
        provider(undefined, './manifests/docs.json', source),
      ]);
      await vi.advanceTimersByTimeAsync(3_000);

      expect((await reads).map(({ status }) => status)).toEqual(['rejected', 'rejected']);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('finishes initializing within 3s while a ref hangs, and checks it on', async () => {
      const auth = new CompositionAuth();
      let answer!: () => void;
      const answered = new Promise<void>((resolve) => (answer = resolve));
      vi.stubGlobal(
        'fetch',
        routeFetch({
          [`${PRIVATE_REF.url}/manifests/components.json`]: () =>
            answered.then(() => new Response(VALID_MANIFEST)),
          [`${PUBLIC_REF.url}/manifests/components.json`]: () => new Response(VALID_MANIFEST),
        })
      );

      let initialized = false;
      const initializing = auth.initialize([PRIVATE_REF, PUBLIC_REF]).then(() => {
        initialized = true;
      });
      await vi.advanceTimersByTimeAsync(2_999);
      expect(initialized).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await initializing;
      expect(auth.buildSources().map((source) => source.id)).toEqual([
        'local',
        'private',
        'public',
      ]);

      answer();
      await vi.advanceTimersByTimeAsync(0);
      const provider = auth.createManifestProvider('http://localhost:6006');
      const source = auth.buildSources().find((s) => s.id === 'private');
      await expect(provider(undefined, './manifests/components.json', source)).resolves.toBe(
        VALID_MANIFEST
      );
    });

    it('warns once about a different OAuth server however the checks settle', async () => {
      const auth = new CompositionAuth();
      const refA = { id: 'a', title: 'A', url: 'https://a.example.com' };
      const refB = { id: 'b', title: 'B', url: 'https://b.example.com' };
      const refC = { id: 'c', title: 'C', url: 'https://c.example.com' };
      const routes = {
        ...privateRefRoutes(refA.url, 'https://auth-x.example.com'),
        ...privateRefRoutes(refB.url, 'https://auth-x.example.com'),
        ...privateRefRoutes(refC.url, 'https://auth-y.example.com'),
      };
      const release: Record<string, () => void> = {};
      for (const ref of [refA, refB, refC]) {
        const challenge = routes[`${ref.url}/manifests/components.json`];
        const gate = new Promise<void>((resolve) => (release[ref.id] = resolve));
        routes[`${ref.url}/manifests/components.json`] = (init) => gate.then(() => challenge(init));
      }
      vi.stubGlobal('fetch', routeFetch(routes));

      const initializing = auth.initialize([refA, refB, refC]);
      for (const id of ['c', 'b', 'a']) {
        release[id]();
        await vi.advanceTimersByTimeAsync(0);
      }
      await initializing;

      const warnings = vi
        .mocked(logger.warn)
        .mock.calls.filter(([message]) => String(message).includes('different OAuth server'));
      expect(warnings).toHaveLength(1);
      expect(warnings[0][0]).toMatch(/"C" uses a different OAuth server \(https:\/\/auth-y/);
      expect(auth.buildWellKnown('http://localhost:6006/mcp')).toMatchObject({
        authorization_servers: ['https://auth-x.example.com'],
      });
    });

    it('says a ref that recovers without a manifest has none', async () => {
      const auth = new CompositionAuth();
      let down = true;
      vi.stubGlobal(
        'fetch',
        routeFetch({
          [`${PUBLIC_REF.url}/manifests/components.json`]: () => {
            if (down) throw new TypeError('fetch failed');
            return new Response('Not found', { status: 404 });
          },
        })
      );
      await auth.initialize([PUBLIC_REF]);
      const provider = auth.createManifestProvider('http://localhost:6006');
      const source = auth.buildSources().find((s) => s.id === 'public');

      down = false;
      await vi.advanceTimersByTimeAsync(5_000);

      await expect(provider(undefined, './manifests/components.json', source)).rejects.toThrow(
        /"Public" has no usable components manifest/
      );
      expect(auth.buildSources().map((s) => s.id)).toEqual(['local']);
    });

    it('slows only the reads of a ref whose re-check hangs', async () => {
      const auth = new CompositionAuth();
      let hang = false;
      let otherDown = true;
      const otherRef = { id: 'other', title: 'Other', url: 'https://other.example.com' };
      vi.stubGlobal(
        'fetch',
        routeFetch({
          [`${PUBLIC_REF.url}/manifests/components.json`]: () => {
            if (hang) return new Promise<Response>(() => {});
            throw new TypeError('fetch failed');
          },
          [`${otherRef.url}/manifests/components.json`]: () => {
            if (otherDown) throw new TypeError('fetch failed');
            return new Response(VALID_MANIFEST);
          },
        })
      );
      await auth.initialize([PUBLIC_REF, otherRef]);
      const provider = auth.createManifestProvider('http://localhost:6006');
      const sources = auth.buildSources();
      const hanging = sources.find((s) => s.id === 'public');
      const other = sources.find((s) => s.id === 'other');
      const read = (source?: (typeof sources)[number]) =>
        provider(undefined, './manifests/components.json', source);

      // The other ref fails its first re-check, so it is next due 10s later
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(read(other)).rejects.toThrow(/"Other" is temporarily unreachable/);

      hang = true;
      let settled = false;
      const hungRead = read(hanging).finally(() => {
        settled = true;
      });
      const rejection = expect(hungRead).rejects.toThrow(/"Public" is temporarily unreachable/);
      await vi.advanceTimersByTimeAsync(2_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await rejection;

      // Due while the hung check is still in flight, the other ref is re-checked on its own
      otherDown = false;
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(read(other)).resolves.toBe(VALID_MANIFEST);
    });

    it.each([503, 429, 408])(
      'treats a %i from the /mcp fallback as a passing outage',
      async (status) => {
        const auth = new CompositionAuth();
        let down = true;
        const routes = privateRefRoutes(PRIVATE_REF.url);
        const challenge = routes[`${PRIVATE_REF.url}/manifests/components.json`];
        routes[`${PRIVATE_REF.url}/manifests/components.json`] = () =>
          new Response('<html>Sign in</html>');
        routes[`POST ${PRIVATE_REF.url}/mcp`] = (init) =>
          down ? new Response('Unavailable', { status }) : challenge(init);
        vi.stubGlobal('fetch', routeFetch(routes));

        await auth.initialize([PRIVATE_REF]);
        expect(auth.buildSources().map((source) => source.id)).toEqual(['local', 'private']);

        down = false;
        await vi.advanceTimersByTimeAsync(5_000);
        await readAllRefs(auth);

        expect(auth.authUrls).toEqual([PRIVATE_REF.url]);
      }
    );

    it('excludes a ref without a manifest whose host answers the /mcp fallback with 501', async () => {
      const auth = new CompositionAuth();
      vi.stubGlobal(
        'fetch',
        routeFetch({
          [`${PUBLIC_REF.url}/manifests/components.json`]: () => new Response('<html></html>'),
          [`POST ${PUBLIC_REF.url}/mcp`]: () => new Response('Unsupported', { status: 501 }),
        })
      );

      await auth.initialize([PUBLIC_REF]);

      expect(auth.buildSources().map((source) => source.id)).toEqual(['local']);
    });

    it('advertises the OAuth server of the first private ref in config order', async () => {
      const auth = new CompositionAuth();
      const refA = { id: 'a', title: 'A', url: 'https://a.example.com' };
      const refB = { id: 'b', title: 'B', url: 'https://b.example.com' };
      const routesA = privateRefRoutes(refA.url, 'https://auth-a.example.com');
      const challengeA = routesA[`${refA.url}/manifests/components.json`];
      let down = true;
      routesA[`${refA.url}/manifests/components.json`] = (init) => {
        if (down) throw new TypeError('fetch failed');
        return challengeA(init);
      };
      vi.stubGlobal(
        'fetch',
        routeFetch({ ...routesA, ...privateRefRoutes(refB.url, 'https://auth-b.example.com') })
      );

      await auth.initialize([refA, refB]);
      expect(auth.buildWellKnown('http://localhost:6006/mcp')).toMatchObject({
        authorization_servers: ['https://auth-b.example.com'],
      });

      down = false;
      await vi.advanceTimersByTimeAsync(5_000);
      await readAllRefs(auth);

      expect(auth.buildWellKnown('http://localhost:6006/mcp')).toMatchObject({
        authorization_servers: ['https://auth-a.example.com'],
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/"B" uses a different OAuth server \(https:\/\/auth-b/)
      );
    });

    it('challenges for a recovered private ref while an earlier ref still hangs', async () => {
      const auth = new CompositionAuth();
      const hanging = { id: 'hanging', title: 'Hanging', url: 'https://hanging.example.com' };
      const routes = privateRefRoutes(PRIVATE_REF.url);
      const challenge = routes[`${PRIVATE_REF.url}/manifests/components.json`];
      let down = true;
      routes[`${PRIVATE_REF.url}/manifests/components.json`] = (init) => {
        if (down) throw new TypeError('fetch failed');
        return challenge(init);
      };
      routes[`${hanging.url}/manifests/components.json`] = () => {
        if (down) throw new TypeError('fetch failed');
        return new Promise<Response>(() => {});
      };
      vi.stubGlobal('fetch', routeFetch(routes));
      // Config order puts the hanging ref first.
      await auth.initialize([hanging, PRIVATE_REF]);
      const provider = auth.createManifestProvider('http://localhost:6006');
      const sources = auth.buildSources();
      const request = new Request('http://localhost:6006/mcp');

      down = false;
      await vi.advanceTimersByTimeAsync(5_000);
      void provider(undefined, './manifests/components.json', sources[1]).catch(() => {});

      await expect(provider(request, './manifests/components.json', sources[2])).rejects.toThrow(
        /Authentication failed/
      );
      expect(auth.hadAuthError(request)).toBe(true);
      expect(auth.requiresAuth).toBe(true);
    });
  });
});
