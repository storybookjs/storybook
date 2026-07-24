import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';

const WHITESPACE = ' \t\n\r';

// A key's closing quote is immediately followed by `:`; a value's by `,` and a newline (or `,`
// at end of input). The lazy body takes the first such candidate, like a left-to-right scan.
const KEY_STRING = /"([\s\S]*?)"(?=:)/y;
const VALUE_STRING = /"([\s\S]*?)"(?=,\r?\n|,$)/y;

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

  const parseString = (role: 'key' | 'value'): string => {
    const pattern = role === 'key' ? KEY_STRING : VALUE_STRING;
    pattern.lastIndex = pos;
    const match = pattern.exec(text);
    if (match === null) {
      return fail('unterminated string');
    }
    pos = pattern.lastIndex;
    return match[1];
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

  // The close-rule heuristics cannot fully disambiguate prose from structure: a string may
  // legitimately contain `",` + newline + a key-shaped fragment, which would fabricate entries.
  // Re-serializing the parse and demanding byte identity turns every such misparse into the loud failure
  const source = text.endsWith('\n') ? text.slice(0, -1) : text;
  const reserialized = reserialize(result, '');
  if (reserialized !== source) {
    let index = 0;
    while (
      index < Math.min(reserialized.length, source.length) &&
      reserialized[index] === source[index]
    ) {
      index += 1;
    }
    pos = index;
    return fail('parsed value does not round-trip to the source bytes');
  }
  return result as StrictArgTypes;
}

/** Writes the corpus grammar exactly: 2-space indent, trailing commas, raw strings, bare tokens. */
const reserialize = (value: unknown, indent: string): string => {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const inner = `${indent}  `;
    return `[\n${value.map((item) => `${inner}${reserialize(item, inner)},\n`).join('')}${indent}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return '{}';
    }
    const inner = `${indent}  `;
    return `{\n${entries
      .map(([key, member]) => `${inner}"${key}": ${reserialize(member, inner)},\n`)
      .join('')}${indent}}`;
  }
  if (Object.is(value, -0)) {
    return '-0';
  }
  return String(value);
};
