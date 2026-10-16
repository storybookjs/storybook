import type { SBType, StrictInputType } from 'storybook/internal/types';

/** Server argTypes skip the client normalizer, so controls are always the object form. */
export type ServiceControl = Exclude<StrictInputType['control'], string>;

export interface ParsedTypeText {
  type: SBType;
  /** Only when core's `inferControls` would not derive it from `type`. */
  control?: ServiceControl;
  options?: (string | number)[];
}

const ARRAY_RE = /^(?:Array<(.+)>|(.+)\[\])$/;
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
const FUNCTION_RE = /^(new\s+)?(<.*>\s*)?\(.*\)\s*=>/;
const UNKNOWN_ARRAY_ELEMENT_TYPE = { name: 'other', value: '' } as const;
/** Real types nest a handful of levels; the cap only stops pathological input. */
const MAX_ARRAY_DEPTH = 8;

export function parseTypeText(text: string | undefined, depth = 0): ParsedTypeText | undefined {
  const trimmed = text?.trim() ?? '';
  const members = normalizeMembers(trimmed);

  if (members.length === 0) {
    return undefined;
  }

  const literalMembers = members.map(parseLiteral);
  const literalValues = literalMembers.filter((literal) => literal !== undefined);
  if (literalValues.length === members.length) {
    return { type: { name: 'enum', value: literalValues } };
  }
  if (literalValues.length > 0 && members.includes('string')) {
    return { type: { name: 'string' } };
  }
  if (literalValues.length > 0) {
    return {
      type: { name: 'other', value: members.join(' | ') },
      ...(members.some(isCallable) ? { control: false as const } : {}),
    };
  }

  const scalar = pickScalar(members);
  if (scalar !== undefined) {
    return scalar;
  }

  if (members.length === 1) {
    const member = stripWrappingParens(members[0]);
    const array = ARRAY_RE.exec(member);
    if (array) {
      const element =
        depth >= MAX_ARRAY_DEPTH
          ? UNKNOWN_ARRAY_ELEMENT_TYPE
          : (parseTypeText(stripWrappingParens(array[1] ?? array[2] ?? ''), depth + 1)?.type ??
            UNKNOWN_ARRAY_ELEMENT_TYPE);
      return element.name === 'enum'
        ? {
            type: { name: 'array', value: element },
            control: { type: 'multi-select' },
            options: element.value as (string | number)[],
          }
        : { type: { name: 'array', value: element } };
    }
    if (member === 'Date') {
      return { type: { name: 'date' }, control: { type: 'date' } };
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

  return {
    type: { name: 'other', value: members.join(' | ') },
    control: false,
  };
}

function normalizeMembers(text: string): string[] {
  if (!text) {
    return [];
  }

  return flattenMembers(text).filter((member) => member && !DROPPED_MEMBERS.has(member));
}

function flattenMembers(text: string): string[] {
  return splitTopLevel(text).flatMap((part) => {
    const member = stripWrappingParens(part);
    const nestedMembers = splitTopLevel(member);
    return nestedMembers.length > 1 ? flattenMembers(member) : [member];
  });
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

function pickScalar(members: string[]): ParsedTypeText | undefined {
  if (members.includes('string')) {
    return { type: { name: 'string' } };
  }

  const hasBoolean = members.some(
    (member) => member === 'boolean' || member === 'true' || member === 'false'
  );
  const hasNumber = members.some((member) => member === 'number' || member === 'bigint');
  if (hasBoolean && hasNumber) {
    return { type: { name: 'other', value: members.join(' | ') } };
  }

  if (hasBoolean) {
    return { type: { name: 'boolean' } };
  }
  if (hasNumber) {
    return { type: { name: 'number' } };
  }
  return undefined;
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
