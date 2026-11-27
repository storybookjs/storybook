// @vitest-environment happy-dom
// happy-dom supplies the DOMParser this helper replaces, so the cases below are asserted against
// the real thing as well.
import { describe, expect, it } from 'vitest';

import { htmlToText } from './html-to-text.ts';

const viaDomParser = (input: unknown): string =>
  new DOMParser().parseFromString(input as string, 'text/html').body.textContent ?? '';

/**
 * `DOMParser` outputs this helper must reproduce exactly. Compodoc's fixture corpus contains one
 * `@default` tag in total, so fixture replay cannot cover any of this.
 */
const DOM_PARSER_CASES: [name: string, input: unknown, expected: string][] = [
  [
    'unwraps a paragraph and decodes numeric entities',
    '<p>&#39;steelblue&#39;</p>\n',
    "'steelblue'\n",
  ],
  [
    'strips tags before decoding, so escaped generics survive',
    '<p>Array&lt;string&gt;</p>\n',
    'Array<string>\n',
  ],
  [
    'leaves a bare `<` followed by whitespace as text',
    '<p>5 > 3 && 2 < 4</p>\n',
    '5 > 3 && 2 < 4\n',
  ],
  ['decodes &nbsp; to U+00A0, not a space', '<p>&nbsp;x&nbsp;</p>\n', '\u00A0x\u00A0\n'],
  ['decodes exactly once', '<p>&amp;amp;</p>\n', '&amp;\n'],
  ['drops HTML comments including a `>` inside them', '<!-- a > b --><p>x</p>\n', 'x\n'],
  ['coerces a missing comment to the literal string "undefined"', undefined, 'undefined'],
];

const ALSO_MATCHING_DOM_PARSER: [name: string, input: unknown, expected: string][] = [
  ['keeps <style> text content', '<style>.a{color:red}</style>x', '.a{color:red}x'],
  ['keeps <script> text content', '<script>var a = 1;</script>x', 'var a = 1;x'],
  ['leaves unknown named references verbatim', '&notarealentity;', '&notarealentity;'],
  ['leaves a lone ampersand alone', 'a & b', 'a & b'],
  ['strips an unescaped `<tag>` the parser would treat as an element', 'Array<string>', 'Array'],
  ['strips attributes along with the tag', '<a href="https://x.test/">link</a>', 'link'],
  ['keeps a quoted attribute value containing `>` inside the tag', '<a href=">">link</a>', 'link'],
  [
    'keeps a single-quoted attribute value containing `>` inside the tag',
    "<a href='a>b'>link</a>",
    'link',
  ],
  ['drops a tag truncated by end of input', 'a <b', 'a '],
  ['handles nested markup', '<p>a <code>b</code> c</p>\n', 'a b c\n'],
  ['returns empty for an empty fragment', '', ''],
];

describe('htmlToText', () => {
  it.each([...DOM_PARSER_CASES, ...ALSO_MATCHING_DOM_PARSER])('%s', (_name, input, expected) => {
    expect(htmlToText(input)).toBe(expected);
    expect(htmlToText(input)).toBe(viaDomParser(input));
  });

  it('preserves the extracted @default of the one fixture that has one', () => {
    // `jsdoc-tags/argtypes.snapshot` records `'steelblue'\n`, surrounding quotes and trailing
    // newline included. That output is a known gap, not a target: it must not change here.
    expect(htmlToText('<p>&#39;steelblue&#39;</p>\n')).toBe("'steelblue'\n");
  });
});
