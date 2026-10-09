import { describe, expect, it } from 'vitest';

import { parseHtml, printHtml } from './html-tree.ts';

const formatHtml = (html: string): string => printHtml(parseHtml(html));

describe('html tree formatting', () => {
  it.each([
    {
      name: 'drops whitespace-only text around an empty element',
      html: `<x-thing
    ></x-thing>`,
      assert: (actual: string) => expect(actual).toMatchInlineSnapshot(`"<x-thing></x-thing>"`),
    },
    {
      name: 'prints nested children on their own lines',
      html: `<x-thing><span>A</span><button>Go</button></x-thing>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(`
"<x-thing>
  <span>A</span>
  <button>Go</button>
</x-thing>"
`),
    },
    {
      name: 'keeps text and adjacent elements inline without changing their boundary whitespace',
      html: `<x-thing>Body <b>text</b> and <code>code</code></x-thing>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(
          `"<x-thing>Body <b>text</b> and <code>code</code></x-thing>"`
        ),
    },
    {
      name: 'keeps inline child groups beside block children',
      html: `<x-thing>Body <b>text</b><section><span>Block</span></section></x-thing>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(`
"<x-thing>
  Body <b>text</b>
  <section>
    <span>Block</span>
  </section>
</x-thing>"
`),
    },
    {
      name: 'keeps punctuation touching an element on the same line',
      html: `<x-thing>Hello <b>world</b>!</x-thing>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(`"<x-thing>Hello <b>world</b>!</x-thing>"`),
    },
    {
      name: 'keeps text-only children inline',
      html: `<x-thing>  Hello
        world </x-thing>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(`"<x-thing>Hello world</x-thing>"`),
    },
    {
      name: 'wraps long start tags',
      html: `<x-thing alpha="12345678901234567890" beta="12345678901234567890" gamma="12345678901234567890"></x-thing>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(`
"<x-thing
  alpha="12345678901234567890"
  beta="12345678901234567890"
  gamma="12345678901234567890"
></x-thing>"
`),
    },
    {
      name: 'keeps quoted attribute values with greater-than signs intact',
      html: `<x-thing label="a > b" data-value='one two'></x-thing>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(
          `"<x-thing label="a > b" data-value="one two"></x-thing>"`
        ),
    },
    {
      name: 'prints void elements without end tags',
      html: `<x-thing><img src="one.png"></img><br></x-thing>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(`
"<x-thing>
  <img src="one.png">
  <br>
</x-thing>"
`),
    },
    {
      name: 'keeps raw text content verbatim',
      html: `<x-thing><style>
        .a > .b {
          color: red;
        }
      </style></x-thing>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(`
"<x-thing>
  <style>
        .a > .b {
          color: red;
        }
      </style>
</x-thing>"
`),
    },
    {
      name: 'keeps pre content verbatim',
      html: `<x-thing><pre>  a
    b  </pre><textarea>  c
    d  </textarea><title>  e
    f  </title></x-thing>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(`
"<x-thing>
  <pre>  a
    b  </pre>
  <textarea>  c
    d  </textarea>
  <title>  e
    f  </title>
</x-thing>"
`),
    },
    {
      name: 'keeps less-than signs in raw text elements',
      html: `<x-thing><script>if (a < b) {}</script></x-thing>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(`
"<x-thing>
  <script>if (a < b) {}</script>
</x-thing>"
`),
    },
    {
      name: 'prints comments on their own lines',
      html: `<x-thing><!-- note --><span>Text</span></x-thing>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(`
"<x-thing>
  <!-- note -->
  <span>Text</span>
</x-thing>"
`),
    },
    {
      name: 'keeps slash in unquoted attribute values',
      html: `<a href=/foo/>`,
      assert: (actual: string) => expect(actual).toMatchInlineSnapshot(`"<a href="/foo/">"`),
    },
    {
      name: 'appends malformed remainder verbatim',
      html: `<x-thing><span>Text</x-other><b>raw</b>`,
      assert: (actual: string) =>
        expect(actual).toMatchInlineSnapshot(`
"<x-thing>
  <span>
    Text
</x-other><b>raw</b>"
`),
    },
  ])('$name', ({ html, assert }) => {
    assert(formatHtml(html));
  });

  it('is idempotent', () => {
    const inputs = [
      `<x-thing
    ></x-thing>`,
      `<x-thing><span>A</span><button>Go</button></x-thing>`,
      `<x-thing>Body <b>text</b> and <code>code</code></x-thing>`,
      `<x-thing>Body <b>text</b><section><span>Block</span></section></x-thing>`,
      `<x-thing>Hello <b>world</b>!</x-thing>`,
      `<x-thing>  Hello
        world </x-thing>`,
      `<x-thing alpha="12345678901234567890" beta="12345678901234567890" gamma="12345678901234567890"></x-thing>`,
      `<x-thing label="a > b" data-value='one two'></x-thing>`,
      `<x-thing><img src="one.png"></img><br></x-thing>`,
      `<x-thing><style>
        .a > .b {
          color: red;
        }
      </style></x-thing>`,
      `<x-thing><script>if (a < b) {}</script></x-thing>`,
      `<x-thing><pre>  a
    b  </pre><textarea>  c
    d  </textarea><title>  e
    f  </title></x-thing>`,
      `<x-thing><!-- note --><span>Text</span></x-thing>`,
      `<x-thing><span>Text</x-other><b>raw</b>`,
      `<my-el /><p>x</p>`,
      `<a href=/foo/>`,
    ];
    for (const input of inputs) {
      const once = formatHtml(input);
      expect(formatHtml(once)).toBe(once);
    }
  });
});
