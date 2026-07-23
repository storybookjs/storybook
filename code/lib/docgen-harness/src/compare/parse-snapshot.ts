import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';

const WHITESPACE = ' \t\n\r';

/**
 * Parses a committed `argtypes*.snapshot` file (vitest pretty-format output) back into the object
 * it serialized. The format is not JSON and not evaluable JS: strings contain literal unescaped
 * newlines and inner double quotes (never backslash escapes), and `undefined` / `NaN` appear as
 * bare tokens. Pretty-format writes one entry per line with a trailing comma everywhere, so a `"`
 * ends a key only when followed by `:` and ends a value only when followed by `,` and a newline —
 * embedded prose like `"red", "warning"` stays inside the string because its comma is followed by
 * a space. Any input outside these corpus rules throws — a silently dropped or misparsed entry
 * would loosen the current-or-better floor invisibly.
 */
export function parseArgTypesSnapshot(
  text: string,
  sourceLabel = 'argtypes snapshot'
): StrictArgTypes {
  let pos = 0;

  const fail = (message: string): never => {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(`Cannot parse ${sourceLabel} at offset ${pos}: ${message}`);
  };

  const skipWhitespace = (): void => {
    while (pos < text.length && WHITESPACE.includes(text[pos])) {
      pos += 1;
    }
  };

  const closesString = (role: 'key' | 'value', after: number): boolean => {
    if (role === 'key') {
      return text[after] === ':';
    }
    if (text[after] !== ',') {
      return false;
    }
    const next = text[after + 1] === '\r' ? after + 2 : after + 1;
    return text[next] === '\n' || next >= text.length;
  };

  const parseString = (role: 'key' | 'value'): string => {
    const opening = pos;
    pos += 1;
    while (pos < text.length) {
      if (text[pos] === '"' && closesString(role, pos + 1)) {
        const value = text.slice(opening + 1, pos);
        pos += 1;
        return value;
      }
      pos += 1;
    }
    pos = opening;
    return fail('unterminated string');
  };

  const parseBareToken = (): unknown => {
    const start = pos;
    while (pos < text.length && /[A-Za-z0-9_.+-]/.test(text[pos])) {
      pos += 1;
    }
    const token = text.slice(start, pos);
    if (token === '') {
      return fail(`unexpected character ${JSON.stringify(text[pos])}`);
    }
    if (token === 'undefined') {
      return undefined;
    }
    if (token === 'NaN') {
      return Number.NaN;
    }
    if (token === 'true') {
      return true;
    }
    if (token === 'false') {
      return false;
    }
    if (token === 'null') {
      return null;
    }
    const asNumber = Number(token);
    if (!Number.isNaN(asNumber)) {
      return asNumber;
    }
    pos = start;
    return fail(`unknown token '${token}'`);
  };

  const parseArray = (): unknown[] => {
    pos += 1;
    const items: unknown[] = [];
    skipWhitespace();
    if (text[pos] === ']') {
      pos += 1;
      return items;
    }
    for (;;) {
      items.push(parseValue());
      skipWhitespace();
      if (text[pos] === ',') {
        pos += 1;
        skipWhitespace();
      } else if (text[pos] !== ']') {
        return fail(`expected ',' or ']' in array`);
      }
      if (text[pos] === ']') {
        pos += 1;
        return items;
      }
    }
  };

  const parseObject = (): Record<string, unknown> => {
    pos += 1;
    const object: Record<string, unknown> = {};
    skipWhitespace();
    if (text[pos] === '}') {
      pos += 1;
      return object;
    }
    for (;;) {
      skipWhitespace();
      if (text[pos] !== '"') {
        return fail('expected a quoted key');
      }
      const keyOffset = pos;
      const key = parseString('key');
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        pos = keyOffset;
        return fail(`duplicate key "${key}"`);
      }
      skipWhitespace();
      if (text[pos] !== ':') {
        return fail(`expected ':' after key "${key}"`);
      }
      pos += 1;
      const value = parseValue();
      // defineProperty keeps a literal "__proto__" key an own property instead of a setter call,
      // and explicit-undefined values stay present (pretty-format prints them; toEqual accepts).
      Object.defineProperty(object, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      skipWhitespace();
      if (text[pos] === ',') {
        pos += 1;
        skipWhitespace();
      } else if (text[pos] !== '}') {
        return fail(`expected ',' or '}' after value of "${key}"`);
      }
      if (text[pos] === '}') {
        pos += 1;
        return object;
      }
    }
  };

  const parseValue = (): unknown => {
    skipWhitespace();
    const ch = text[pos];
    if (ch === undefined) {
      return fail('unexpected end of input');
    }
    if (ch === '{') {
      return parseObject();
    }
    if (ch === '[') {
      return parseArray();
    }
    if (ch === '"') {
      return parseString('value');
    }
    return parseBareToken();
  };

  skipWhitespace();
  if (text[pos] !== '{') {
    return fail('expected an object at the top level');
  }
  const result = parseObject();
  skipWhitespace();
  if (pos < text.length) {
    return fail('unexpected trailing content');
  }
  return result as StrictArgTypes;
}
