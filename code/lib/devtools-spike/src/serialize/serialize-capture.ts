import type {
  CapturedProp,
  CapturePayload,
  FlaggedProp,
  StoryGenerationResult,
  UnserializableSentinel,
} from '../types.ts';

export interface SerializeOptions {
  existingStoryNames?: readonly string[];
}

type Blocker = { reason: FlaggedProp['reason']; what: string; at?: string };

type PropVerdict = { arg: unknown } | { flagged: FlaggedProp };

const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainObject = (value: object): boolean => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const isReactElement = (value: object): boolean =>
  '$$typeof' in value && 'props' in value && 'type' in value;

/**
 * Client-transport sentinels stand in for values that could not cross JSON.
 * Each maps back to the same flag the live value would have produced.
 */
const SENTINEL_REASONS: Record<UnserializableSentinel['__sbDevtools'], FlaggedProp['reason']> = {
  function: 'function',
  symbol: 'symbol',
  'class-instance': 'class-instance',
  'react-element': 'unknown',
  bigint: 'unknown',
  unknown: 'unknown',
};

const isSentinel = (value: object): value is UnserializableSentinel =>
  '__sbDevtools' in value && 'label' in value;

/**
 * Find the first reason a captured value cannot round-trip as a story arg.
 * Cycle detection tracks the current path only, so shared (non-cyclic)
 * references still serialize the way JSON would.
 */
const inspect = (value: unknown, at: string, ancestors: readonly object[]): Blocker | null => {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'object') {
    switch (typeof value) {
      case 'string':
      case 'boolean':
        return null;
      case 'number':
        return Number.isFinite(value)
          ? null
          : { reason: 'unknown', what: 'a non-finite number', at };
      case 'function':
        return { reason: 'function', what: 'a function', at };
      case 'symbol':
        return { reason: 'symbol', what: 'a symbol', at };
      default:
        return { reason: 'unknown', what: `a ${typeof value} value`, at };
    }
  }
  const object = value;
  if (isSentinel(object)) {
    return { reason: SENTINEL_REASONS[object.__sbDevtools], what: object.label, at };
  }
  if (isReactElement(object)) {
    return { reason: 'unknown', what: 'a React element', at };
  }
  if (ancestors.includes(object)) {
    return { reason: 'unknown', what: 'a circular reference', at };
  }
  const seen = [...ancestors, object];
  if (Array.isArray(object)) {
    for (const [index, element] of object.entries()) {
      const blocked = inspect(element, at ? `${at}[${index}]` : `[${index}]`, seen);
      if (blocked) {
        return blocked;
      }
    }
    return null;
  }
  if (!isPlainObject(object)) {
    const className = object.constructor?.name ?? 'anonymous';
    return { reason: 'class-instance', what: `a ${className} class instance`, at };
  }
  for (const [key, child] of Object.entries(object)) {
    if (RESERVED_KEYS.has(key)) {
      return { reason: 'unknown', what: `a reserved "${key}" key`, at };
    }
    const blocked = inspect(child, at ? `${at}.${key}` : key, seen);
    if (blocked) {
      return blocked;
    }
  }
  return null;
};

const guidanceFor = (name: string, blocker: Blocker): string => {
  const at = blocker.at && blocker.at !== name ? ` at "${blocker.at}"` : '';
  switch (blocker.reason) {
    case 'function':
      return `Prop "${name}" contains a function${at}. Story args must be serializable, so it was not captured — wire the function in the story's render or play function.`;
    case 'symbol':
      return `Prop "${name}" contains a symbol${at}. Story args must be serializable — replace it with a string or another plain value.`;
    case 'class-instance':
      return `Prop "${name}" contains ${blocker.what}${at}. Story args must be serializable — replace it with a plain object holding the fields the story needs.`;
    default:
      return `Prop "${name}" contains ${blocker.what}${at}, which is not serialized. Replace it with a plain value the story can use.`;
  }
};

const verdictFor = (prop: CapturedProp): PropVerdict => {
  const { name, kind, value } = prop;
  if (RESERVED_KEYS.has(name)) {
    return {
      flagged: {
        name,
        reason: 'unknown',
        guidance: `Prop name "${name}" is a reserved object key — rename the prop or pass it under a safe key.`,
      },
    };
  }
  if (value === undefined) {
    const claimed = kind === 'primitive' || kind === 'array' || kind === 'object';
    return {
      flagged: {
        name,
        reason: claimed ? 'unknown' : kind,
        guidance: `Prop "${name}" was captured as ${
          claimed ? 'unrepresentable' : kind.replace(/-/g, ' ')
        } with no value. Re-capture the component, or set this arg manually in the story.`,
      },
    };
  }
  const blocker = inspect(value, name, []);
  if (blocker) {
    return { flagged: { name, reason: blocker.reason, guidance: guidanceFor(name, blocker) } };
  }
  return { arg: value };
};

const nextVariantName = (taken: readonly string[]): string => {
  const names = new Set(taken);
  if (!names.has('Primary')) {
    return 'Primary';
  }
  let variant = 2;
  while (names.has(`Primary${variant}`)) {
    variant += 1;
  }
  return `Primary${variant}`;
};

export function serializeCapture(
  payload: CapturePayload,
  options: SerializeOptions = {}
): StoryGenerationResult {
  const args: Record<string, unknown> = {};
  const argTypes: Record<string, StoryGenerationResult['argTypes'][string]> = {};
  const flagged: FlaggedProp[] = [];

  for (const prop of payload.props) {
    const verdict = verdictFor(prop);
    if ('arg' in verdict) {
      args[prop.name] = verdict.arg;
    } else {
      flagged.push(verdict.flagged);
      argTypes[prop.name] = { control: false, description: verdict.flagged.guidance };
    }
  }

  return {
    storyName: nextVariantName(options.existingStoryNames ?? []),
    args,
    argTypes,
    flagged,
  };
}
