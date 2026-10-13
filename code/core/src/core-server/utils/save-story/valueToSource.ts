import { printString } from '../../../csf-tools/estree/editor.ts';

export function valueToSource<T>(literal: T, quote = '"'): string {
  if (literal === null) {
    return 'null';
  }
  switch (typeof literal) {
    case 'function':
      return literal.toString();
    case 'number':
    case 'boolean':
      return String(literal);
    case 'string':
      return printString(literal, quote);
    case 'undefined':
      return 'undefined';
    default:
      if (Array.isArray(literal)) {
        return `[${literal.map((item) => valueToSource(item, quote)).join(', ')}]`;
      }
      return objectSource(
        Object.entries(literal as Record<string, unknown>)
          .filter(([, value]) => typeof value !== 'undefined')
          .map(([key, value]) => `${printString(key, quote)}: ${valueToSource(value, quote)}`)
      );
  }
}

// An object literal laid out one member per line, so formatters keep it expanded.
export const objectSource = (members: string[]) =>
  members.length === 0
    ? '{}'
    : `{\n${members.map((member) => `  ${member.split('\n').join('\n  ')},`).join('\n')}\n}`;
