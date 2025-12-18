/**
 * Representation of prop types to unify the data coming from different docgen tools. Currently we
 * only use react-docgen, but by having a common mapping we can eventually support tools like Volar
 * and others.
 */
export type ComponentDocgenPropType =
  | { kind: 'boolean' }
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'date' }
  | { kind: 'node'; renderer: 'react' } // TODO: this would be extended to support other renderers
  | { kind: 'function' }
  | { kind: 'null' }
  | { kind: 'void' }
  | { kind: 'literal'; value: unknown }
  | { kind: 'union'; elements: ComponentDocgenPropType[] }
  | { kind: 'array'; element: ComponentDocgenPropType }
  | { kind: 'tuple'; elements: ComponentDocgenPropType[] }
  | { kind: 'object'; properties: Record<string, ComponentDocgenPropType> }
  | { kind: 'any' }
  | { kind: 'unknown' }
  | { kind: 'other'; name?: string };

export type ComponentDocgenPropInfo = {
  required: boolean;
  type: ComponentDocgenPropType;
};

export type ComponentDocgenData = {
  props?: Record<string, ComponentDocgenPropInfo>;
};

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

export function generateMockValueFromDocgenType(
  type: ComponentDocgenPropType,
  propName?: string
): unknown {
  switch (type.kind) {
    case 'boolean':
      return true;

    case 'number':
      return 42;

    case 'string': {
      const name = propName ?? '';
      const tokens = tokenize(name);
      if (hasAny(tokens, COLOR_TOKENS)) {
        return '#ff0000';
      }

      if (hasAny(tokens, DATE_TOKENS)) {
        return '2025-01-01';
      }

      const mostLikelyType = getMostLikelyTypeFromTokens(tokens);

      switch (mostLikelyType) {
        case 'image':
          return 'https://placehold.co/600x400?text=Storybook';

        case 'url':
          return 'https://example.com';

        case 'email':
          return 'storybook@example.com';

        case 'phone':
          return '1234567890';
      }

      return name || 'Hello world';
    }

    case 'date':
      return new Date('2025-01-01');

    case 'node':
      if (type.renderer === 'react') {
        return propName ?? 'Hello world';
      }
      return 'node';

    case 'function':
      return '__function__';

    case 'object': {
      const result: Record<string, unknown> = {};

      for (const [key, valueType] of Object.entries(type.properties ?? {})) {
        result[key] = generateMockValueFromDocgenType(valueType, key);
      }

      return result;
    }

    case 'union': {
      if (!type.elements?.length) {
        return '';
      }

      const literal = type.elements.find((el) => el.kind === 'literal');
      if (literal?.kind === 'literal') {
        return normalizeStringLiteral(literal.value);
      }

      return generateMockValueFromDocgenType(type.elements[0], propName);
    }

    case 'array': {
      if (type.element.kind === 'other') {
        return [];
      }
      return [generateMockValueFromDocgenType(type.element, propName)];
    }

    case 'tuple':
      return (type.elements ?? []).map((el) => generateMockValueFromDocgenType(el));

    case 'literal':
      return normalizeStringLiteral(type.value ?? 'mock literal');

    case 'null':
      return null;

    case 'void':
      return undefined;

    case 'any':
    case 'unknown':
      return type.kind;

    case 'other': {
      if (
        type.name?.startsWith('React') ||
        type.name?.includes('Event') ||
        type.name?.includes('Element')
      ) {
        return '__function__';
      }

      return type.name ?? null;
    }
  }
}

export function generateMockPropsFromDocgen(docgenData: ComponentDocgenData | null) {
  const required: Record<string, unknown> = {};
  const optional: Record<string, unknown> = {};

  if (!docgenData?.props) {
    return { required, optional };
  }

  for (const [propName, propInfo] of Object.entries(docgenData.props)) {
    const mockValue = generateMockValueFromDocgenType(propInfo.type, propName);

    if (propInfo.required) {
      required[propName] = mockValue;
    } else {
      optional[propName] = mockValue;
    }
  }

  return { required, optional };
}
