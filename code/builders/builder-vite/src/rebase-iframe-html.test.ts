import { describe, expect, it } from 'vitest';

import { rebaseIframeHtml } from './rebase-iframe-html.ts';

const base = '/embed/secret/';

describe('rebaseIframeHtml', () => {
  it('declares the import map before any module script', () => {
    const html = rebaseIframeHtml(
      '<html><head lang="en"><script type="module">import "/@react-refresh";</script></head></html>',
      base
    );

    expect(html.indexOf('type="importmap"')).toBeLessThan(html.indexOf('type="module"'));
    expect(html).toContain(JSON.stringify({ imports: { '/': base, [base]: base } }));
  });

  it('prefixes root-absolute script sources and leaves other URLs alone', () => {
    const html = rebaseIframeHtml(
      [
        '<head>',
        '<script type="module" src="/@vite/client"></script>',
        '<script src="./relative.js"></script>',
        '<script src="https://cdn.example.com/lib.js"></script>',
        '<script src="//cdn.example.com/lib.js"></script>',
        '<link rel="icon" href="/favicon.svg" />',
        '</head>',
      ].join('\n'),
      base
    );

    expect(html).toContain('<script type="module" src="/embed/secret/@vite/client"></script>');
    expect(html).toContain('<script src="./relative.js"></script>');
    expect(html).toContain('<script src="https://cdn.example.com/lib.js"></script>');
    expect(html).toContain('<script src="//cdn.example.com/lib.js"></script>');
    expect(html).toContain('<link rel="icon" href="/favicon.svg" />');
  });
});
