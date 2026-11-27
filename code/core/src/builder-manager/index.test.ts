import { cp, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type { Middleware, Options } from 'storybook/internal/types';

import { vol } from 'memfs';

import { build, executor, start } from './index.ts';
import { readTemplate } from './utils/template.ts';

// Spy-only: the builder's writes to the output directory are redirected to `memfs` below.
vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger');
// Refs are also discovered from the dependencies of the nearest package manifest. Pinned to none,
// so that the host's file system cannot add refs.
vi.mock(import('empathic/package'), async (importOriginal) => ({
  ...(await importOriginal()),
  up: () => undefined,
}));
vi.mock(import('./utils/template.ts'), async (importOriginal) => ({
  ...(await importOriginal()),
  readTemplate: vi.fn(),
}));

const template = `<title><%= title %></title>
<script>window['REFS'] = <%- globals.REFS %>;</script>`;

const pageWithCheckedRefs = `<title>Example - Storybook</title>
<script>window['REFS'] = {
  "icons": {
    "title": "Icons",
    "url": "https://icons.example.com",
    "id": "icons",
    "type": "server-checked"
  }
};</script>`;

const presets: Record<string, unknown> = {
  core: { builder: '@storybook/builder-vite', channelOptions: { wsToken: 'token' } },
  env: {},
  favicon: './favicon.svg',
  features: {},
  framework: '@storybook/react-vite',
  logLevel: 'info',
  managerHead: '',
  refs: { icons: { title: 'Icons', url: 'https://icons.example.com' } },
  title: 'Example',
};

const optionsWith = (overrides: Record<string, unknown> = {}) =>
  ({
    configDir: '/project/.storybook',
    configType: 'DEVELOPMENT',
    outputDir: '/project/output',
    presets: {
      apply: async (name: string, fallback?: unknown) => {
        const preset = name in overrides ? overrides[name] : presets[name];
        return typeof preset === 'function' ? preset(fallback) : (preset ?? fallback);
      },
    },
  }) as unknown as Options;

const compileWith = (compilation: Promise<{ outputFiles: [] }>) =>
  vi
    .spyOn(executor, 'get')
    .mockResolvedValue((() => compilation) as unknown as Awaited<ReturnType<typeof executor.get>>);

const composedRef = () => {
  const iframe = Promise.withResolvers<Response>();
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(iframe.promise)
      .mockResolvedValue({ ok: false } as Response)
  );
  return { answer: () => iframe.resolve({ ok: true, status: 200 } as Response) };
};

const startManager = async (presetOverrides?: Record<string, unknown>) => {
  const use = vi.fn<(pattern: string, handler: Middleware) => void>();
  await start({
    startTime: process.hrtime(),
    options: optionsWith(presetOverrides),
    router: { use },
  } as unknown as Parameters<typeof start>[0]);

  return (path: '/' | '/index.html', url: string = path) => {
    const handler = use.mock.calls.find(([pattern]) => pattern === path)![1];
    const response = { statusCode: 0, setHeader: vi.fn(), write: vi.fn(), end: vi.fn() };
    const next = vi.fn();
    const answered = handler(
      { url } as IncomingMessage,
      response as unknown as ServerResponse,
      next
    );
    return { response, next, answered };
  };
};

// Node reports a rejection as unhandled once the tick that rejected it has ended
const nextTick = () => new Promise((resolve) => setImmediate(resolve));

const unhandledRejections: unknown[] = [];
const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(rm).mockImplementation(memfs.fs.promises.rm as unknown as typeof rm);
  vi.mocked(writeFile).mockImplementation(
    memfs.fs.promises.writeFile as unknown as typeof writeFile
  );
  vi.mocked(readTemplate).mockResolvedValue(template);
  compileWith(Promise.resolve({ outputFiles: [] }));
  unhandledRejections.length = 0;
  process.on('unhandledRejection', onUnhandledRejection);
});

afterEach(() => {
  process.off('unhandledRejection', onUnhandledRejection);
  vi.unstubAllGlobals();
  vol.reset();
});

describe('start', () => {
  it('finishes while the ref check is still pending', async () => {
    composedRef();

    let finished = false;
    void startManager().then(() => {
      finished = true;
    });

    await vi.waitFor(() => expect(finished).toBe(true));
  });

  it.each([
    ['/', '/'],
    ['/', '/?path=/story/example--story'],
    ['/index.html', '/index.html'],
  ] as const)(
    'holds a request to the %s route for %s until the ref check has finished, then serves the checked refs',
    async (path, url) => {
      const ref = composedRef();
      const request = await startManager();

      const { response, answered } = request(path, url);
      await nextTick();
      expect(response.end).not.toHaveBeenCalled();

      ref.answer();
      await answered;

      expect(response.statusCode).toBe(200);
      expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(response.write).toHaveBeenCalledExactlyOnceWith(pageWithCheckedRefs);
      expect(response.end).toHaveBeenCalledOnce();
    }
  );

  it('leaves a request below / for another path to the next handler', async () => {
    composedRef().answer();
    const request = await startManager();

    const { response, next, answered } = request('/', '/iframe.html');
    await answered;

    expect(next).toHaveBeenCalledOnce();
    expect(response.end).not.toHaveBeenCalled();
  });

  it('fails when the refs config throws, without an unhandled rejection while the manager compiles', async () => {
    const compilation = Promise.withResolvers<{ outputFiles: [] }>();
    compileWith(compilation.promise);

    const started = startManager({
      refs: () => {
        throw new Error('refs config broken');
      },
    });
    await nextTick();
    compilation.resolve({ outputFiles: [] });

    await expect(started).rejects.toThrow('refs config broken');
    expect(unhandledRejections).toEqual([]);
  });

  it('fails when a ref has no url', async () => {
    await expect(startManager({ refs: { broken: { title: 'Broken' } } })).rejects.toThrow(
      TypeError
    );
  });

  it('fails when the page cannot be rendered, while the ref check is still pending', async () => {
    composedRef();
    vi.mocked(readTemplate).mockResolvedValue('<%= missing.value %>');

    await expect(startManager()).rejects.toThrow('missing is not defined');
  });

  it('logs once and leaves the answer to the router when the page fails with the checked refs', async () => {
    const ref = composedRef();
    vi.mocked(readTemplate).mockResolvedValue(
      `<% if (globals.REFS.includes('"type"')) { throw new Error('page failed'); } %>`
    );
    const request = await startManager();

    ref.answer();
    await nextTick();

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('page failed'));
    expect(unhandledRejections).toEqual([]);
    for (const path of ['/', '/index.html'] as const) {
      const { response, answered } = request(path);
      await expect(answered).rejects.toThrow('page failed');
      expect(response.end).not.toHaveBeenCalled();
    }
  });
});

describe('build', () => {
  it('writes the page only once the ref check has finished, with the checked refs', async () => {
    const ref = composedRef();
    vi.mocked(cp).mockResolvedValue();
    vol.mkdirSync('/project/output', { recursive: true });

    const built = build({ startTime: process.hrtime(), options: optionsWith() });
    await nextTick();
    expect(vol.existsSync('/project/output/index.html')).toBe(false);

    ref.answer();
    await built;

    expect(vol.readFileSync('/project/output/index.html', 'utf8')).toBe(pageWithCheckedRefs);
  });
});
