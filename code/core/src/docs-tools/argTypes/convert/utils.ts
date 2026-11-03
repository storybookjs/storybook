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
  content.replace(/\\(u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]+\}|.)/g, (_, escape: string) => {
    if (escape.startsWith('u')) {
      return String.fromCodePoint(parseInt(escape.slice(1).replace(/[{}]/g, ''), 16));
    }
    if (escape in ESCAPE_MAP) {
      return ESCAPE_MAP[escape];
    }
    return escape; // `\\` stays `\`, `\'` stays `'`, unknown escapes pass the char through
  });

export const parseLiteral = (str: string) => {
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
    return decodeEscapes(trimmedValue);
  }

  return Number.isNaN(Number(trimmedValue)) ? trimmedValue : Number(trimmedValue);
};
