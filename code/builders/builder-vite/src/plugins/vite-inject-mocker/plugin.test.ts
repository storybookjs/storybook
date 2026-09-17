import { describe, expect, it, vi } from 'vitest';

vi.mock('node:url', () => ({
  fileURLToPath: vi.fn(() => '/fake/mocker-runtime.js'),
}));

vi.stubGlobal('import', { meta: { resolve: () => 'file:///fake/mocker-runtime.js' } });

const { viteInjectMockerRuntime } = await import('./plugin.js');

function makeHtml(headAttrs = ''): string {
  return `<!doctype html><html><head${headAttrs}><meta charset="utf-8" /></head><body></body></html>`;
}

describe('vite-inject-mocker plugin — transformIndexHtml', () => {
  function createPlugin(command: 'build' | 'serve', base = '/') {
    const plugin = viteInjectMockerRuntime({ previewConfigPath: null }) as any;
    plugin.configResolved({ command, base } as any);
    return plugin;
  }

  it.each<{ name: string; command: 'build' | 'serve'; base: string; expectedSrc: string }>([
    {
      name: 'build uses a relative path',
      command: 'build',
      base: '/',
      expectedSrc: './vite-inject-mocker-entry.js',
    },
    {
      name: 'dev at root uses an absolute path',
      command: 'serve',
      base: '/',
      expectedSrc: '/vite-inject-mocker-entry.js',
    },
    {
      name: 'dev under a mounted base prefixes it',
      command: 'serve',
      base: '/__storybook/',
      expectedSrc: '/__storybook/vite-inject-mocker-entry.js',
    },
  ])('$name', ({ command, base, expectedSrc }) => {
    const plugin = createPlugin(command, base);
    const result = plugin.transformIndexHtml(makeHtml());

    expect(result).toContain(`src="${expectedSrc}"`);
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

    const cleaned = result.replace(
      '<script type="module" src="./vite-inject-mocker-entry.js"></script>',
      ''
    );
    expect(cleaned).toBe(html);
  });
});
