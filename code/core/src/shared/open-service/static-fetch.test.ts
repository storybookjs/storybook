import * as v from 'valibot';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  OpenServiceStaticSnapshotInvalidError,
  OpenServiceStaticSnapshotLoadError,
} from '../../manager-errors.ts';
import { createTestChannel, installTestChannel } from '../../channels/test-channel.ts';
import { defineService } from './service-definition.ts';
import { clearRegistry, serviceRegistryApi } from './service-registry.ts';
import { registerService as registerPreviewService } from './preview.ts';
import { createServiceRuntime } from './service-runtime.ts';
import { staticLoadSyncServiceDef } from './sync-test/static-load/definition.ts';
import {
  fetchStaticSnapshot,
  shouldUseBrowserStaticLoader,
  type StaticLoaderContext,
} from './static-fetch.ts';

const staticFetchServiceDef = defineService({
  id: 'internal-fixture/static-fetch',
  description: 'Fixture for browser static snapshot loading.',
  initialState: { entries: {} } as { entries: Record<string, string> },
  queries: {
    getEntry: {
      description: 'Reads one entry; load normally calls a command.',
      input: v.object({ id: v.string() }),
      output: v.optional(v.string()),
      handler: (input, ctx) => ctx.self.state.entries[input.id],
      load: async (input, ctx) => {
        await ctx.self.commands.populate(input);
      },
      staticPath: (input) => `${input.id}.json`,
    },
  },
  commands: {
    populate: {
      description: 'Populates one entry via a live command.',
      input: v.object({ id: v.string() }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.entries[input.id] = 'live';
        });
      },
    },
  },
});

const staticLoaderContext = {
  serviceId: staticFetchServiceDef.id,
  queryName: 'getEntry',
  input: { id: 'alpha' },
} satisfies StaticLoaderContext;

describe('shouldUseBrowserStaticLoader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false in development', () => {
    vi.stubGlobal('CONFIG_TYPE', 'DEVELOPMENT');

    expect(shouldUseBrowserStaticLoader()).toBe(false);
  });

  it('is true in production', () => {
    vi.stubGlobal('CONFIG_TYPE', 'PRODUCTION');

    expect(shouldUseBrowserStaticLoader()).toBe(true);
  });
});

describe('fetchStaticSnapshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches snapshots from /services/<logicalPath>', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ entries: { alpha: 'from-file' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchStaticSnapshot(
      'internal-fixture/static-fetch/alpha.json',
      staticLoaderContext
    );

    expect(fetchMock).toHaveBeenCalledWith('/services/internal-fixture/static-fetch/alpha.json');
    expect(snapshot).toEqual({ entries: { alpha: 'from-file' } });
  });

  it('rejects when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, statusText: 'Not Found' }))
    );

    const error = await fetchStaticSnapshot('missing.json', staticLoaderContext).catch(
      (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(OpenServiceStaticSnapshotLoadError);
    expect(error).toMatchObject({
      data: {
        serviceId: staticFetchServiceDef.id,
        queryName: 'getEntry',
        input: { id: 'alpha' },
        logicalPath: 'missing.json',
        url: '/services/missing.json',
        cause: { status: 404, statusText: 'Not Found' },
        status: 404,
        statusText: 'Not Found',
      },
    });
  });

  it('rejects when fetch fails', async () => {
    const cause = new Error('network down');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw cause;
      })
    );

    await expect(fetchStaticSnapshot('network.json', staticLoaderContext)).rejects.toMatchObject({
      data: {
        serviceId: staticFetchServiceDef.id,
        queryName: 'getEntry',
        input: { id: 'alpha' },
        logicalPath: 'network.json',
        url: '/services/network.json',
        cause,
      },
    });
  });

  it('rejects when JSON parsing fails', async () => {
    const cause = new SyntaxError('bad json');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw cause;
        },
      }))
    );

    await expect(fetchStaticSnapshot('broken.json', staticLoaderContext)).rejects.toMatchObject({
      data: {
        serviceId: staticFetchServiceDef.id,
        queryName: 'getEntry',
        input: { id: 'alpha' },
        logicalPath: 'broken.json',
        url: '/services/broken.json',
        cause,
      },
    });
  });

  it('rejects when the snapshot is not a plain object', async () => {
    const received = ['not an object'];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => received,
      }))
    );

    const error = await fetchStaticSnapshot('invalid.json', staticLoaderContext).catch(
      (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(OpenServiceStaticSnapshotInvalidError);
    expect(error).toMatchObject({
      data: {
        serviceId: staticFetchServiceDef.id,
        queryName: 'getEntry',
        input: { id: 'alpha' },
        logicalPath: 'invalid.json',
        url: '/services/invalid.json',
        received,
      },
    });
  });
});

describe('static loader in service runtime', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches snapshots inline instead of running the authored load command in production', async () => {
    vi.stubGlobal('CONFIG_TYPE', 'PRODUCTION');
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/services/internal-fixture/static-fetch/alpha.json') {
        return { ok: true, json: async () => ({ entries: { alpha: 'static-alpha' } }) };
      }
      if (url === '/services/internal-fixture/static-fetch/beta.json') {
        return { ok: true, json: async () => ({ entries: { beta: 'static-beta' } }) };
      }
      throw new Error(`Unexpected static url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const runtime = createServiceRuntime(
      staticFetchServiceDef,
      { registryApi: serviceRegistryApi },
      structuredClone(staticFetchServiceDef.initialState)
    );

    await runtime.queries.getEntry.loaded({ id: 'alpha' });
    await runtime.queries.getEntry.loaded({ id: 'beta' });

    expect(runtime.queries.getEntry({ id: 'alpha' })).toBe('static-alpha');
    expect(runtime.queries.getEntry({ id: 'beta' })).toBe('static-beta');
    expect(fetchMock).toHaveBeenCalledWith('/services/internal-fixture/static-fetch/alpha.json');
    expect(fetchMock).toHaveBeenCalledWith('/services/internal-fixture/static-fetch/beta.json');
  });

  it('resolves static-load demo entries through the preview registerService path', async () => {
    vi.stubGlobal('CONFIG_TYPE', 'PRODUCTION');

    const channel = createTestChannel();
    installTestChannel(channel);
    clearRegistry();
    onTestFinished(() => {
      clearRegistry();
      installTestChannel(null);
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('alpha.json')) {
          return {
            ok: true,
            json: async () => ({ entries: { alpha: 'static-load:alpha' } }),
          };
        }

        if (url.endsWith('beta.json')) {
          return {
            ok: true,
            json: async () => ({ entries: { beta: 'static-load:beta' } }),
          };
        }

        return { ok: false };
      })
    );

    const service = registerPreviewService(staticLoadSyncServiceDef);

    await expect(service.queries.getEntry.loaded({ id: 'alpha' })).resolves.toBe(
      'static-load:alpha'
    );
  });

  it('runs the authored load when not in a static build', async () => {
    const runtime = createServiceRuntime(
      staticFetchServiceDef,
      { registryApi: serviceRegistryApi },
      structuredClone(staticFetchServiceDef.initialState)
    );

    await runtime.queries.getEntry.loaded({ id: 'alpha' });

    expect(runtime.queries.getEntry({ id: 'alpha' })).toBe('live');
  });
});
