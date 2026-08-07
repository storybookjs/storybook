import { decodeHTMLAttribute } from 'entities';

/**
 * Node-safe replacement for `new DOMParser().parseFromString(html, 'text/html').body.textContent`.
 *
 * Compodoc renders JSDoc comments through Markdown, so `@default` tag values arrive as HTML
 * fragments. The browser path unwrapped them with `DOMParser`, which does not exist in a Node
 * worker.
 *
 * Three rules are load-bearing:
 *
 * 1. Tags are stripped BEFORE entities are decoded. Decoding first turns `Array&lt;string&gt;` into
 *    `Array`, because the decoded `<string>` then looks like a tag.
 * 2. A `<` only opens a tag when the next character is a letter, `/`, `!` or `?`. HTML treats `< 4`
 *    as text, so `5 > 3 && 2 < 4` must survive intact.
 * 3. Entities are decoded exactly once. `&amp;amp;` is `&amp;`, not `&`.
 */

/** `<!-- ... -->`, including an unterminated one, which the HTML parser runs to end of input. */
const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/g;

/**
 * Everything between a tag's name and its closing `>`. A `>` inside a quoted attribute value does
 * not end the tag, so `<a href=">">` is one tag rather than a tag plus the text `">`. The branches
 * are mutually exclusive (a `=` either introduces a quoted value or does not), which keeps matching
 * linear instead of backtracking over every `=` in a tag that never closes.
 */
const TAG_INNER = `(?:[^>=]|=\\s*"[^"]*"|=\\s*'[^']*'|=(?!\\s*["']))*`;

/** A complete tag. The character class after `<` is what keeps `< 4` out of the match. */
const HTML_TAG = new RegExp(`<[a-zA-Z!/?]${TAG_INNER}>`, 'g');

/** A tag truncated by end of input. The HTML parser drops it rather than emitting text. */
const TRUNCATED_HTML_TAG = new RegExp(`<[a-zA-Z!/?]${TAG_INNER}$`);

/**
 * Unwraps an HTML fragment to the plain text `body.textContent` would yield.
 *
 * Non-string input is coerced with `String()`, matching `parseFromString`'s own coercion: a bare
 * `@default` with no comment yields the literal string `"undefined"`, which is what the browser
 * path already recorded.
 *
 * Decoding uses `entities`' attribute mode rather than its text mode: text mode expands a
 * semicolon-less legacy reference that runs straight into a letter, which would turn
 * `&notarealentity;` into `¬arealentity;` where a browser leaves it verbatim.
 */
export const htmlToText = (html: unknown): string => {
  const source = typeof html === 'string' ? html : String(html);

  const stripped = source
    .replace(HTML_COMMENT, '')
    .replace(HTML_TAG, '')
    .replace(TRUNCATED_HTML_TAG, '');

  return decodeHTMLAttribute(stripped);
};
