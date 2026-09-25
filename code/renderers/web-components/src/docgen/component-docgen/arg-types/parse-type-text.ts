import type { SBType, StrictInputType } from 'storybook/internal/types';

const ARRAY_RE = /^(?:Array<(.+)>|(.+)\[\])$/;
const BARE_IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/;
const DROPPED_MEMBERS = new Set([
  'undefined',
  'null',
  'void',
  'any',
  'unknown',
  'never',
  'string & {}',
  '(string & {})',
]);
const NON_ENUM_IDENTIFIERS = new Set(['true', 'false', 'Date', 'bigint', 'symbol']);
const WIDENING_MEMBERS = new Set(['string', 'number', 'boolean', 'object', '{}', '[]']);
const FUNCTION_RE = /^(new\s+)?(<.*>\s*)?\(.*\)\s*=>/;
const UNKNOWN_ARRAY_ELEMENT_TYPE = { name: 'other', value: '' } as const;

export interface ParsedTypeText {
  type: SBType;
  /** Only when core's `inferControls` would not derive it from `type`. */
  control?: StrictInputType['control'];
  options?: (string | number)[];
}

export function parseTypeText(text: string | undefined): ParsedTypeText | undefined {
  const trimmed = text?.trim() ?? '';
  const members = normalizeMembers(trimmed);

  if (members.length === 0) {
    return undefined;
  }

  const literalMembers = pickLiteralMembers(members);
  if (literalMembers !== undefined) {
    return { type: { name: 'enum', value: literalMembers } };
  }
  if (hasStructuralLiteralUnion(members)) {
    return {
      type: { name: 'other', value: members.join(' | ') },
      control: members.some((member) => parseLiteral(member) === undefined && isCallable(member))
        ? false
        : 'object',
    };
  }

  const scalar = pickScalar(members);
  if (scalar !== undefined) {
    return { type: scalar };
  }

  if (members.length === 1) {
    const member = stripWrappingParens(members[0]);
    const array = ARRAY_RE.exec(member);
    if (array) {
      const element =
        parseTypeText(stripWrappingParens(array[1] ?? array[2] ?? ''))?.type ??
        UNKNOWN_ARRAY_ELEMENT_TYPE;
      return element.name === 'enum'
        ? {
            type: { name: 'array', value: element },
            control: 'multi-select',
            options: element.value as (string | number)[],
          }
        : { type: { name: 'array', value: element } };
    }
    if (member === 'Date') {
      return { type: { name: 'date' }, control: 'date' };
    }
    if (isBareObjectType(member)) {
      return { type: { name: 'object', value: {} } };
    }
    if (isBareArrayType(member)) {
      return { type: { name: 'array', value: UNKNOWN_ARRAY_ELEMENT_TYPE } };
    }
    if (isCallable(member)) {
      return { type: { name: 'function' } };
    }
    if (isObjectLike(member)) {
      return { type: { name: 'object', value: {} } };
    }
  }

  return { type: { name: 'other', value: members.join(' | ') }, control: false };
}

function normalizeMembers(text: string): string[] {
  if (!text) {
    return [];
  }

  const members = splitTopLevel(text)
    .map(stripWrappingParens)
    .filter((member) => !DROPPED_MEMBERS.has(member));
  const hasLiteral = members.some((member) => parseLiteral(member) !== undefined);
  return (hasLiteral ? members.filter((member) => !WIDENING_MEMBERS.has(member)) : members).filter(
    Boolean
  );
}

function parseLiteral(text: string): string | number | undefined {
  const stringLiteral = /^(['"])(.*)\1$/.exec(text);
  if (stringLiteral) {
    return stringLiteral[2];
  }
  if (/^-?(?:\d+|\d*\.\d+)$/.test(text)) {
    return Number(text);
  }
  return undefined;
}

function pickScalar(members: string[]): SBType | undefined {
  if (members.includes('string')) {
    return { name: 'string' };
  }
  if (members.some((member) => member === 'boolean' || member === 'true' || member === 'false')) {
    return { name: 'boolean' };
  }
  if (members.some((member) => member === 'number' || member === 'bigint')) {
    return { name: 'number' };
  }
  return undefined;
}

/** Literal unions promote to enums unless non-literals include structural, callable, boolean or Date type text. */
function pickLiteralMembers(members: string[]): (string | number)[] | undefined {
  const literalMembers = members.map(parseLiteral).filter((literal) => literal !== undefined);
  if (literalMembers.length === 0) {
    return undefined;
  }
  return members.every((member) => parseLiteral(member) !== undefined || isEnumCompatible(member))
    ? literalMembers
    : undefined;
}

function hasStructuralLiteralUnion(members: string[]): boolean {
  return (
    members.some((member) => parseLiteral(member) !== undefined) &&
    members.some((member) => parseLiteral(member) === undefined && !isEnumCompatible(member))
  );
}

function isEnumCompatible(text: string): boolean {
  return (
    !isCallable(text) &&
    !NON_ENUM_IDENTIFIERS.has(text) &&
    (WIDENING_MEMBERS.has(text) || BARE_IDENTIFIER_RE.test(text))
  );
}

function isCallable(text: string): boolean {
  return text === 'Function' || FUNCTION_RE.test(text) || /^\([^)]*\)\s*:/.test(text);
}

function isBareArrayType(text: string): boolean {
  return text.toLowerCase() === 'array';
}

function isBareObjectType(text: string): boolean {
  return text.toLowerCase() === 'object';
}

function isObjectLike(text: string): boolean {
  return /^\{.*\}$/.test(text) || /^\[.*\]$/.test(text) || text.includes('<');
}

function stripWrappingParens(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('(')) {
    return trimmed;
  }

  let depth = 0;
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return index === trimmed.length - 1 ? trimmed.slice(1, -1).trim() : trimmed;
      }
    }
  }
  return trimmed;
}

function splitTopLevel(text: string): string[] {
  const members: string[] = [];
  let current = '';
  let depth = 0;
  let hasTopLevelArrow = false;
  let quote: string | undefined;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const previous = text[index - 1];

    if (quote) {
      current += char;
      if (char === quote && previous !== '\\') {
        quote = undefined;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === '=' && text[index + 1] === '>' && depth === 0) {
      hasTopLevelArrow = true;
    }

    if ('<{[('.includes(char)) {
      depth += 1;
    } else if ('>}])'.includes(char) && !(char === '>' && previous === '=')) {
      depth = Math.max(0, depth - 1);
    }

    if (char === '|' && depth === 0 && !hasTopLevelArrow) {
      members.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  members.push(current.trim());
  return members;
}
