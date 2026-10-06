import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveCompositionSources } from './resolve-composition-sources.ts';

const VALID_MANIFEST =
  '{"v":1,"components":{"button":{"id":"button","name":"Button","path":"src/Button.tsx"}}}';

function optionsWithRefs(refs: unknown): Options {
  return { presets: { apply: vi.fn().mockResolvedValue(refs) } } as unknown as Options;
}

describe('resolveCompositionSources', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('strips a trailing slash from ref URLs before probing and in the resolved source', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(VALID_MANIFEST),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await resolveCompositionSources(
      optionsWithRefs({
        'design-system': { title: 'Design System', url: 'https://ds.example.com/' },
      })
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ds.example.com/manifests/components.json',
      expect.any(Object)
    );
    expect(result.sources).toEqual([
      { id: 'local', title: 'Local' },
      { id: 'design-system', title: 'Design System', url: 'https://ds.example.com' },
    ]);
    expect(result.multiSource).toBe(true);
  });

  it('excludes refs with disable: true, matching the UI', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(VALID_MANIFEST),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await resolveCompositionSources(
      optionsWithRefs({
        enabled: { title: 'Enabled', url: 'https://enabled.example.com' },
        disabled: { title: 'Disabled', url: 'https://disabled.example.com', disable: true },
      })
    );

    expect(mockFetch).not.toHaveBeenCalledWith(
      'https://disabled.example.com/manifests/components.json',
      expect.any(Object)
    );
    expect(result.sources?.map((source) => source.id)).toEqual(['local', 'enabled']);
  });

  it('skips a ref whose manifest probe 404s and warns that the manifest was not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        // manifest probe: 404
        .mockResolvedValueOnce({ ok: false, status: 404 })
        // /mcp auth fallback: 200 (no auth either)
        .mockResolvedValueOnce({ status: 200 })
    );

    const result = await resolveCompositionSources(
      optionsWithRefs({ ds: { title: 'Design System', url: 'https://ds.example.com' } })
    );

    expect(result.sources?.map((source) => source.id)).toEqual(['local']);
    expect(result.multiSource).toBe(false);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/"Design System".*manifest.*not found.*componentsManifest/s)
    );
  });

  it('classifies a 200 HTML response (SPA fallback) as manifest not found, not a version mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        // manifest probe: SPA fallback rewrites serve the app shell with a 200
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve('<!doctype html><html><body>App</body></html>'),
        })
        // /mcp auth fallback: 200 (no auth)
        .mockResolvedValueOnce({ status: 200 })
    );

    const result = await resolveCompositionSources(
      optionsWithRefs({ ds: { title: 'Design System', url: 'https://ds.example.com' } })
    );

    expect(result.sources?.map((source) => source.id)).toEqual(['local']);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/"Design System".*manifest.*not found/s)
    );
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('version mismatch'));
  });

  it('skips a ref whose manifest is JSON but fails validation and warns about a version mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        // manifest probe: real JSON in a shape this reader does not understand
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{"v":99,"unknown":"format"}'),
        })
        // /mcp auth fallback: 200 (no auth)
        .mockResolvedValueOnce({ status: 200 })
    );

    const result = await resolveCompositionSources(
      optionsWithRefs({ ds: { title: 'Design System', url: 'https://ds.example.com' } })
    );

    expect(result.sources?.map((source) => source.id)).toEqual(['local']);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/"Design System".*failed validation.*version mismatch/s)
    );
  });

  it('skips an unreachable ref and warns with the network error and a restart hint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await resolveCompositionSources(
      optionsWithRefs({ ds: { title: 'Design System', url: 'https://ds.example.com' } })
    );

    expect(result.sources?.map((source) => source.id)).toEqual(['local']);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/"Design System".*could not be reached.*ECONNREFUSED.*restart/s)
    );
  });

  it('includes a valid ref without any warning', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(VALID_MANIFEST),
      })
    );

    const result = await resolveCompositionSources(
      optionsWithRefs({ ds: { title: 'Design System', url: 'https://ds.example.com' } })
    );

    expect(result.sources?.map((source) => source.id)).toEqual(['local', 'ds']);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('keeps the auth-required flow for private refs unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        // manifest probe: 401 with OAuth challenge
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({
            'WWW-Authenticate':
              'Bearer resource_metadata="https://private.example.com/.well-known/oauth-protected-resource"',
          }),
        })
        // resource metadata
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              resource: 'https://private.example.com/mcp',
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

    const result = await resolveCompositionSources(
      optionsWithRefs({ private: { title: 'Private', url: 'https://private.example.com/' } })
    );

    expect(result.sources?.map((source) => source.id)).toEqual(['local', 'private']);
    expect(result.compositionAuth.requiresAuth).toBe(true);
    expect(result.compositionAuth.authUrls).toEqual(['https://private.example.com']);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
