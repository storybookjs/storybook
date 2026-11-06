import { describe, expect, it } from 'vitest';

import { canonicalizeTurbosnapHtml } from './turbosnap-output.ts';

describe('canonicalizeTurbosnapHtml', () => {
  it('returns resource edges while preserving comments, inline strings, and unrelated attributes', async () => {
    const html =
      '<!-- <script src="assets/a.js"></script> --><script>const name="assets/a.js";</script><script src="./assets/a.js" data-name="assets/a.js"></script><link rel="modulepreload" href="./assets/a.js">';
    expect(
      await canonicalizeTurbosnapHtml(html, 'iframe.html', new Map([['assets/a.js', 'story-a']]))
    ).toEqual({
      code: '<!-- <script src="assets/a.js"></script> --><script>const name="assets/a.js";</script><script src="story-a" data-name="assets/a.js"></script><link rel="modulepreload" href="story-a">',
      dependencies: ['assets/a.js'],
    });
  });

  it('normalizes only parsed inline import specifiers and adds dependencies globally', async () => {
    const html = '<script type="module">import("./assets/a.js");</script>';
    expect(
      await canonicalizeTurbosnapHtml(html, 'iframe.html', new Map([['assets/a.js', 'a']]))
    ).toEqual({
      code: '<script type="module">import("a");</script>',
      dependencies: ['assets/a.js'],
    });
    await expect(
      canonicalizeTurbosnapHtml('<script>import(window.story)</script>', 'iframe.html', new Map())
    ).rejects.toThrow('dynamic-inline-output-reference');
  });

  it('tracks encoded and suffixed HTML imports and rejects base overrides', async () => {
    const references = new Map([['assets/A.js', 'a']]);
    expect(
      await canonicalizeTurbosnapHtml(
        '<script src="assets/%41.js?global#anchor"></script>',
        'iframe.html',
        references
      )
    ).toEqual({ code: '<script src="a?global#anchor"></script>', dependencies: ['assets/A.js'] });
    await expect(
      canonicalizeTurbosnapHtml(
        '<base href="nested/"><script src="assets/A.js"></script>',
        'iframe.html',
        references
      )
    ).rejects.toThrow('unsupported-html-base');
  });

  it('rejects CRLF offsets using exact raw inline text', async () => {
    const html =
      '<script type="module">' +
      '\r\n'.repeat(13) +
      'globalThis.label="red"; import "./assets/a.js";</script>';
    for (const source of [html, html.replace('"red"', '"tan"')])
      await expect(
        canonicalizeTurbosnapHtml(source, 'iframe.html', new Map([['assets/a.js', 'a']]))
      ).rejects.toThrow('normalized-inline-source');
  });

  it('resolves relative references from their owning HTML directory', async () => {
    const references = new Map([['A.js', 'a']]);
    await expect(
      canonicalizeTurbosnapHtml('<script src="A.js"></script>', 'nested/iframe.html', references)
    ).rejects.toThrow('unresolved-html-output-reference');
    expect(
      (
        await canonicalizeTurbosnapHtml(
          '<script src="../A.js"></script>',
          'nested/iframe.html',
          references
        )
      ).dependencies
    ).toEqual(['A.js']);
  });

  it('rejects unresolved local scripts and import maps', async () => {
    await expect(
      canonicalizeTurbosnapHtml(
        '<script src="base/assets/A.js"></script>',
        'iframe.html',
        new Map()
      )
    ).rejects.toThrow('unresolved-html-output-reference');
    await expect(
      canonicalizeTurbosnapHtml('<script type="importmap">{}</script>', 'iframe.html', new Map())
    ).rejects.toThrow('unsupported-html-importmap');
  });

  it('retains unknown and remote resources verbatim', async () => {
    const html =
      '<script src="https://example.invalid/a.js"></script><link rel="stylesheet" href="other.css">';
    expect(await canonicalizeTurbosnapHtml(html, 'iframe.html', new Map([['a.js', 'a']]))).toEqual({
      code: html,
      dependencies: [],
    });
  });
});
