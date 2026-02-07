import { describe, expect, it, vi } from 'vitest';

/**
 * Unit-tests for the vite-inject-mocker plugin, focused on the
 * `transformIndexHtml` hook which must emit a **relative** `src`
 * during production builds (so Storybook artifacts load when hosted
 * at non-root paths, e.g. GitHub Pages) and an **absolute** `src`
 * during development (so Vite's dev-server `resolveId` can match it).
 *
 * @see https://github.com/storybookjs/storybook/issues/32428
 */

// We need to mock the import.meta.resolve call and node:url before
// importing the plugin, because the module resolves the mocker
// runtime path at import time.
vi.mock('node:url', () => ({
  fileURLToPath: vi.fn(() => '/fake/mocker-runtime.js'),
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
