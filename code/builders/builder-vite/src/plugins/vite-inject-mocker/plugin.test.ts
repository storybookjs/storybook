import { describe, expect, it, vi } from 'vitest';

/**
 * Unit-tests for the vite-inject-mocker plugin.
 *
 * `transformIndexHtml` must emit a **relative** `src` during production builds (so Storybook
 * artifacts load when hosted at non-root paths, e.g. GitHub Pages) and an **absolute** `src`
 * during development (so the dev-server middleware can intercept the request).
 *
 * In dev mode, `configureServer` registers a Connect middleware that serves the pre-bundled
 * mocker runtime directly — bypassing Vite 7's transform pipeline which could deadlock on that
 * module. The `resolveId` hook is therefore only active in build mode.
 *
 * @see https://github.com/storybookjs/storybook/issues/32428
 */

// We need to mock the import.meta.resolve call and node:url before
// importing the plugin, because the module resolves the mocker
// runtime path at import time.
vi.mock('node:url', () => ({
  fileURLToPath: vi.fn(() => '/fake/mocker-runtime.js'),
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => 'fake mocker runtime content'),
}));

// Mock import.meta.resolve
vi.stubGlobal('import', { meta: { resolve: () => 'file:///fake/mocker-runtime.js' } });

// Dynamic import after mocks are set up
const { viteInjectMockerRuntime } = await import('./plugin.js');

function makeHtml(headAttrs = '') {
  return `<!doctype html><html><head${headAttrs}><meta charset="utf-8" /></head><body></body></html>`;
}

describe('vite-inject-mocker plugin — transformIndexHtml', () => {
  function createPlugin(command: 'build' | 'serve') {
    const plugin = viteInjectMockerRuntime({ previewConfigPath: null }) as any;
    // Simulate Vite calling configResolved
    plugin.configResolved({ command } as any);
    return plugin;
  }

  it('uses a relative path (./…) in build mode', () => {
    const plugin = createPlugin('build');
    const html = makeHtml();
    const result = plugin.transformIndexHtml(html);

    expect(result).toContain('src="./vite-inject-mocker-entry.js"');
    expect(result).not.toContain('src="/vite-inject-mocker-entry.js"');
  });

  it('uses an absolute path (/…) in dev mode', () => {
    const plugin = createPlugin('serve');
    const html = makeHtml();
    const result = plugin.transformIndexHtml(html);

    expect(result).toContain('src="/vite-inject-mocker-entry.js"');
    // Ensure it's not the relative form
    expect(result).not.toContain('src="./vite-inject-mocker-entry.js"');
  });

  it('injects the script tag right after <head>', () => {
    const plugin = createPlugin('build');
    const html = makeHtml();
    const result = plugin.transformIndexHtml(html);

    const headIndex = result.indexOf('<head>');
    const scriptIndex = result.indexOf('<script type="module"');
    expect(scriptIndex).toBeGreaterThan(headIndex);
    expect(scriptIndex).toBe(headIndex + '<head>'.length);
  });

  it('handles <head> tags with attributes', () => {
    const plugin = createPlugin('build');
    const html = makeHtml(' lang="en"');
    const result = plugin.transformIndexHtml(html);

    expect(result).toContain('src="./vite-inject-mocker-entry.js"');
    expect(result).toContain('<head lang="en"><script type="module"');
  });

  it('returns undefined when <head> is missing', () => {
    const plugin = createPlugin('build');
    const result = plugin.transformIndexHtml('<html><body></body></html>');
    expect(result).toBeUndefined();
  });

  it('preserves the rest of the HTML unchanged', () => {
    const plugin = createPlugin('build');
    const html = makeHtml();
    const result = plugin.transformIndexHtml(html);

    // Remove the injected script to verify the rest is intact
    const cleaned = result.replace(
      '<script type="module" src="./vite-inject-mocker-entry.js"></script>',
      ''
    );
    expect(cleaned).toBe(html);
  });
});

describe('vite-inject-mocker plugin — resolveId', () => {
  it('resolves the entry path in build mode', () => {
    const plugin = viteInjectMockerRuntime({ previewConfigPath: null }) as any;
    plugin.configResolved({ command: 'build' });

    expect(plugin.resolveId('/vite-inject-mocker-entry.js')).toBe('/fake/mocker-runtime.js');
  });

  it('does not resolve the entry path in dev mode (middleware handles it instead)', () => {
    const plugin = viteInjectMockerRuntime({ previewConfigPath: null }) as any;
    plugin.configResolved({ command: 'serve' });

    expect(plugin.resolveId('/vite-inject-mocker-entry.js')).toBeUndefined();
  });

  it('does not resolve unrelated paths', () => {
    const plugin = viteInjectMockerRuntime({ previewConfigPath: null }) as any;
    plugin.configResolved({ command: 'build' });

    expect(plugin.resolveId('/some-other-file.js')).toBeUndefined();
  });
});

describe('vite-inject-mocker plugin — configureServer middleware', () => {
  function createDevPlugin() {
    const plugin = viteInjectMockerRuntime({ previewConfigPath: null }) as any;
    plugin.configResolved({ command: 'serve' });
    return plugin;
  }

  it('registers a middleware that serves the runtime for the entry path', () => {
    const plugin = createDevPlugin();

    const middlewares: Array<(req: any, res: any, next: any) => void> = [];
    const server = {
      watcher: { on: vi.fn() },
      ws: { send: vi.fn() },
      middlewares: { use: vi.fn((fn) => middlewares.push(fn)) },
    };

    plugin.configureServer(server);
    expect(middlewares).toHaveLength(1);

    const req = { url: '/vite-inject-mocker-entry.js' };
    const res = { setHeader: vi.fn(), end: vi.fn() };
    const next = vi.fn();

    middlewares[0](req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/javascript');
    expect(res.end).toHaveBeenCalledWith('fake mocker runtime content');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for unrelated URLs', () => {
    const plugin = createDevPlugin();

    const middlewares: Array<(req: any, res: any, next: any) => void> = [];
    const server = {
      watcher: { on: vi.fn() },
      ws: { send: vi.fn() },
      middlewares: { use: vi.fn((fn) => middlewares.push(fn)) },
    };

    plugin.configureServer(server);

    const req = { url: '/some-other-file.js' };
    const res = { setHeader: vi.fn(), end: vi.fn() };
    const next = vi.fn();

    middlewares[0](req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });
});
