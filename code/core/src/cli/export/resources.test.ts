import { describe, expect, it, vi } from 'vitest';

import type { APIRequestContext } from 'playwright';

import { createResources } from './resources.ts';

const fixture = (ok = true) => {
  const dispose = vi.fn();
  const get = vi.fn(async () => ({
    ok: () => ok,
    status: () => (ok ? 200 : 404),
    body: async () => Buffer.from('image bytes'),
    headers: () => ({ 'content-type': 'image/png' }),
    dispose,
  }));
  return {
    get,
    dispose,
    resources: createResources({ get } as unknown as APIRequestContext, 1000),
  };
};

describe('export resources', () => {
  it('deduplicates assets and preserves URL fragments', async () => {
    const { get, resources } = fixture();
    const first = await resources.asset('./image.png#a', 'https://example.com/library/');
    const second = await resources.asset('./image.png#b', 'https://example.com/library/');
    expect(first).toMatch(/^assets\/[a-f0-9]+\.png#a$/);
    expect(second).toBe(first.replace('#a', '#b'));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('rewrites CSS URLs with parentheses and escaped characters', async () => {
    const { get, resources } = fixture();
    const css = await resources.css(
      'url("im\\61 ge(1).png"), url("image(1).png")',
      'https://example.com/'
    );
    expect(css).toMatch(/^url\("assets\/.*\.png"\), url\("assets\/.*\.png"\)$/);
    expect(get).toHaveBeenCalledWith('https://example.com/image(1).png', { timeout: 1000 });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('keeps embedded images and local SVG references offline', async () => {
    const { get, resources } = fixture();
    expect(
      await resources.css('url("data:image/png;base64,AA==")', 'https://example.com/')
    ).toContain('data:image/png;base64,AA==');
    expect(await resources.css('url("#mask")', 'https://example.com/')).toBe('url("#mask")');
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects missing resources and releases their response', async () => {
    const { resources, dispose } = fixture(false);
    await expect(resources.asset('missing.png', 'https://example.com/')).rejects.toThrow(
      'HTTP 404'
    );
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('keeps quotes in embedded SVG URLs escaped for CSS', async () => {
    const { resources, get } = fixture();
    const result = await resources.css(
      `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>')`,
      'https://example.com/'
    );
    expect(result).toBe(
      'url("data:image/svg+xml,<svg xmlns=\\22 http://www.w3.org/2000/svg\\22 ></svg>")'
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('retains active font conditions and skips inactive font downloads', async () => {
    const { resources, get } = fixture();
    const css = await resources.fonts(
      '@media print{@font-face{font-family:Print;src:url(missing.woff2)}}' +
        '@supports (display:grid){@font-face{font-family:Demo;src:local(Demo)}}',
      'https://example.com/',
      async (kind, condition) => kind === 'supports' && condition === '(display:grid)'
    );
    expect(css).toBe('@supports (display:grid){@font-face{font-family:Demo;src:local(Demo)}}');
    expect(get).not.toHaveBeenCalled();
  });

  it('skips inactive conditional stylesheet imports', async () => {
    const { resources, get } = fixture();
    const css = await resources.fonts(
      '@import "missing.css" layer(fonts) supports(display:grid) print;',
      'https://example.com/',
      async (kind) => kind === 'supports'
    );
    expect(css).toBe('');
    expect(get).not.toHaveBeenCalled();
  });

  it('preserves layer declarations that establish font precedence', async () => {
    const css = await fixture().resources.fonts(
      '@layer second,first;@layer first{body{color:red}}' +
        '@layer second{@font-face{font-family:Demo;src:local(Demo)}}',
      'https://example.com/',
      async () => true
    );
    expect(css).toContain('@layer second,first;');
    expect(css).toContain('@layer first{}');
    expect(css).toContain('@layer second{@font-face');
    expect(css).not.toContain('color:red');
  });

  it('retains active import conditions and repeated import order', async () => {
    const get = vi.fn(async (url: string) => ({
      ok: () => true,
      url: () => url,
      text: async () => '@font-face{font-family:Demo;src:local(Demo)}',
      dispose: vi.fn(),
    }));
    const resources = createResources({ get } as unknown as APIRequestContext, 1000);
    const css = await resources.fonts(
      '@import "fonts.css" layer(fonts) supports(display:grid) screen;' + '@import "fonts.css";',
      'https://example.com/',
      async () => true
    );
    expect(css).toContain('@layer fonts');
    expect(css).toContain('@supports (display:grid)');
    expect(css).toContain('@media screen');
    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it.each(['file:///private/image.png', 'blob:https://example.com/id', 'javascript:alert(1)'])(
    'rejects nonportable resources: %s',
    async (url) => {
      await expect(fixture().resources.asset(url, 'https://example.com/')).rejects.toThrow(
        /protocol/
      );
    }
  );

  it('embeds fonts without copying unrelated stylesheet rules', async () => {
    const { resources } = fixture();
    const css = await resources.fonts(
      '@font-face{font-family:Demo;src:url(./font.woff2)}body{color:red}',
      'https://example.com/styles/',
      async () => true
    );
    expect(css).toContain('@font-face');
    expect(css).toContain('assets/');
    expect(css).not.toContain('color:red');
  });

  it('includes imported fonts in every artboard and terminates import cycles', async () => {
    const get = vi.fn(async (url: string) => ({
      ok: () => true,
      url: () => url,
      text: async () => '@import "./fonts.css";@font-face{font-family:Demo;src:local(Demo)}',
      dispose: vi.fn(),
    }));
    const resources = createResources({ get } as unknown as APIRequestContext, 1000);
    const first = await resources.fonts(
      '@import "./fonts.css";',
      'https://example.com/',
      async () => true
    );
    const second = await resources.fonts(
      '@import "./fonts.css";',
      'https://example.com/',
      async () => true
    );
    expect(first).toContain('@font-face');
    expect(second).toBe(first);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
