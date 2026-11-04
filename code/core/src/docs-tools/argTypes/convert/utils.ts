const QUOTE_REGEX = /^['"]|['"]$/g;
export const trimQuotes = (str: string) => str.replace(QUOTE_REGEX, '');
const ESCAPE_MAP: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  v: '\v',
};

/** Decodes the escape sequences of a JS string literal's content (`'a\nb'` is a newline). */
const decodeEscapes = (content: string) =>
  content.replace(/\\(u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]+\}|.)/g, (match, escape: string) => {
    if (escape.startsWith('u')) {
      // A bare or malformed `\u` (e.g. an RDT value that merely contains `\us`) is not a
      // valid unicode escape: `u` is a JS non-escape character, so pass the `u` through
      // instead of calling fromCodePoint on NaN (RangeError).
      const hex = escape[1] === '{' ? escape.slice(2, -1) : escape.slice(1);
      if (!/^[0-9a-fA-F]+$/.test(hex)) {
        return escape;
      }
      const code = Number.parseInt(hex, 16);
      // `\u{110000}` is outside the unicode scalar range — keep it as written.
      return code > 0x10ffff ? match : String.fromCodePoint(code);
    }
    if (escape in ESCAPE_MAP) {
      return ESCAPE_MAP[escape];
    }
    return escape; // `\\` stays `\`, `\'` stays `'`, unknown escapes pass the char through
  });

export const parseLiteral = (str: string, options?: { decodeEscapes?: boolean }) => {
  const quoted = str.length > 1 && /^['"]/.test(str) && str.endsWith(str[0]);
  const trimmedValue = trimQuotes(str);

  // Bare `true`/`false` source tokens are boolean literals and must survive as booleans —
  // otherwise selecting `false` in Controls passes the truthy string `"false"` to the
  // component. Quoted forms (`'"true"'`) stay string literals.
  if (!quoted && (trimmedValue === 'true' || trimmedValue === 'false')) {
    return trimmedValue === 'true';
  }

  // A quoted token is a string literal: decode the serialized escapes so Controls passes
  // the value the component declared (`'a\nb'` is a newline, not backslash-n). Members
  // arrive JSON.stringify'd from the component-meta extractor or as single-quoted source
  // tokens from the legacy converter — the JS escape grammar covers both.
  if (quoted) {
    // That grammar must NOT run on already-decoded values: react-docgen-typescript wraps
    // the compiler's decoded literal in plain quotes (`'"' + type.value + '"'`), so a
    // second decode corrupts `\d`, `C:\dir` and crashes on `\u` — those tokens opt out.
    return options?.decodeEscapes === false ? trimmedValue : decodeEscapes(trimmedValue);
  }

  return Number.isNaN(Number(trimmedValue)) ? trimmedValue : Number(trimmedValue);
};
