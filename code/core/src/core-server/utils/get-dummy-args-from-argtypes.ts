import type { ArgTypes, SBType } from 'storybook/internal/csf';

export type ComponentArgTypesInfo = {
  required: boolean;
  type: SBType;
};

export type ComponentArgTypesData = {
  props?: Record<string, ComponentArgTypesInfo>;
};

export type Options = {
  skipUrlGeneration?: boolean;
};

export const STORYBOOK_FN_PLACEHOLDER = '[[STORYBOOK_FN_PLACEHOLDER]]';

/**
 * Generate dummy props using ArgTypes instead of ComponentArgTypesData This provides more accurate
 * dummy generation by leveraging ArgTypes structure
 */
export function generateDummyArgsFromArgTypes(argTypes: ArgTypes, options: Options = {}) {
  const required: Record<string, unknown> = {};
  const optional: Record<string, unknown> = {};

  for (const [propName, argType] of Object.entries(argTypes)) {
    // Determine if prop is required
    const isRequired = argType.type && typeof argType.type === 'object' && argType.type.required;

    // Generate dummy value directly from SBType
    let dummyValue: unknown;
    if (typeof argType.type === 'string') {
      // Handle scalar type strings - convert to SBType
      const sbType: SBType = { name: argType.type };
      dummyValue = generateDummyValueFromSBType(sbType, propName, options);
    } else if (argType.type && typeof argType.type === 'object') {
      // Handle SBType objects directly
      dummyValue = generateDummyValueFromSBType(argType.type, propName, options);
    } else {
      // Fallback as we don't know what the type is
      dummyValue = undefined;
    }

    if (isRequired) {
      required[propName] = dummyValue;
    } else {
      optional[propName] = dummyValue;
    }
  }

  return { required, optional };
}

// Tokenize prop names so we can use them to determine the most likely type of the prop e.g. image, url, etc.
function tokenize(name: string): string[] {
  if (!name) {
    return [];
  }

  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .split(' ')
    .map((t) => t.toLowerCase())
    .filter(Boolean);
}

function hasAny(tokens: string[], set: Set<string>): boolean {
  return tokens.some((t) => set.has(t));
}

const URL_TOKENS = new Set(['url', 'href', 'link']);
const IMAGE_TOKENS = new Set(['image', 'img', 'photo', 'avatar', 'logo']);
const EMAIL_TOKENS = new Set(['email', 'e-mail', 'mail']);
const PHONE_TOKENS = new Set(['phone', 'tel', 'telephone', 'mobile', 'cell']);

const COLOR_TOKENS = new Set(['color', 'background', 'bg']);
const DATE_TOKENS = new Set(['date', 'at', 'time', 'timestamp']);

const NEGATIVE_IMAGE_TOKENS = new Set([
  'size',
  'width',
  'height',
  'ratio',
  'count',
  'status',
  'loading',
  'config',
  'options',
  'variant',
]);

type MostLikelyType = 'image' | 'url' | 'email' | 'phone';

function getMostLikelyTypeFromTokens(tokens: string[]): MostLikelyType | null {
  const score: Partial<Record<MostLikelyType, number>> = {};

  for (const token of tokens) {
    if (IMAGE_TOKENS.has(token)) {
      score.image = (score.image ?? 0) + 3;
    }
    if (URL_TOKENS.has(token)) {
      score.url = (score.url ?? 0) + 2;
    }
    if (EMAIL_TOKENS.has(token)) {
      score.email = (score.email ?? 0) + 3;
    }
    if (PHONE_TOKENS.has(token)) {
      score.phone = (score.phone ?? 0) + 3;
    }
  }

  // Penalize image metadata so we don't end up adding an image URL to a prop like imageWidth
  if (hasAny(tokens, NEGATIVE_IMAGE_TOKENS)) {
    score.image = (score.image ?? 0) - 4;
  }

  let best: MostLikelyType | null = null;
  let bestScore = 0;

  for (const [kind, value] of Object.entries(score) as [MostLikelyType, number][]) {
    if (value > bestScore) {
      bestScore = value;
      best = kind;
    }
  }

  return best;
}

function normalizeStringLiteral(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function generateDummyValueFromSBType(
  sbType: SBType,
  propName?: string,
  options?: Options
): unknown {
  switch (sbType.name) {
    case 'boolean':
      return true;

    case 'number':
      return 0;

    case 'string': {
      const name = propName ?? '';
      const tokens = tokenize(name);
      if (hasAny(tokens, COLOR_TOKENS)) {
        return '#ff4785';
      }

      if (hasAny(tokens, DATE_TOKENS)) {
        return new Date().toLocaleDateString();
      }

      const mostLikelyType = getMostLikelyTypeFromTokens(tokens);

      if (options?.skipUrlGeneration && (mostLikelyType === 'image' || mostLikelyType === 'url')) {
        return name;
      }

      switch (mostLikelyType) {
        case 'image':
          return 'https://placehold.co/600x400?text=Storybook';

        case 'url':
          return 'https://example.com';

        case 'email':
          return 'storybook@example.com';

        case 'phone':
          return '1234567890';

        default:
          return name ?? 'Hello world';
      }
    }

    case 'date':
      return new Date();

    case 'node':
      return propName ?? 'Hello world';

    case 'function':
      return STORYBOOK_FN_PLACEHOLDER;

    case 'literal':
      return normalizeStringLiteral(sbType.value);

    case 'object': {
      const result: Record<string, unknown> = {};

      for (const [key, valueType] of Object.entries(sbType.value)) {
        result[key] = generateDummyValueFromSBType(valueType, key, options);
      }

      return result;
    }

    case 'union': {
      if (!sbType.value?.length) {
        return '';
      }

      // Look for literal types in the union
      const literalType = sbType.value.find((t) => t.name === 'literal');
      if (literalType?.name === 'literal') {
        return normalizeStringLiteral(literalType.value);
      }

      return generateDummyValueFromSBType(sbType.value[0], propName, options);
    }

    case 'array': {
      // If we don't know what the element is, be conservative and return empty.
      if (sbType.value.name === 'other') {
        return [];
      }
      return [generateDummyValueFromSBType(sbType.value, propName, options)];
    }

    case 'tuple':
      return sbType.value.map((el) => generateDummyValueFromSBType(el, undefined, options));

    case 'enum':
      return sbType.value[0] ?? propName;

    case 'intersection': {
      // For intersections, combine all object types
      const objectTypes = sbType.value.filter((t) => t.name === 'object');
      if (objectTypes.length > 0) {
        const result: Record<string, unknown> = {};
        objectTypes.forEach((objType) => {
          if (objType.name === 'object') {
            Object.entries(objType.value).forEach(([key, type]) => {
              result[key] = generateDummyValueFromSBType(type, key, options);
            });
          }
        });
        return result;
      }
      return {};
    }

    case 'other': {
      const value = sbType.value;
      if (value?.startsWith('React') || value?.includes('Event') || value?.includes('Element')) {
        return STORYBOOK_FN_PLACEHOLDER;
      }

      if (value === 'null') {
        return null;
      }

      if (value === 'void' || value === 'undefined') {
        return undefined;
      }

      return null;
    }
  }
}
