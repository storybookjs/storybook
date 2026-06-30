import { logger, once } from 'storybook/internal/client-logger';

import { isPlainObject } from 'es-toolkit/predicate';

import memoize from 'memoizerific';
import { parse, stringify } from 'picoquery';
import { dedent } from 'ts-dedent';
import {
  DEEPLY_EQUAL,
  DEEP_DIFF_MAX_DEPTH,
  deepDiff,
  isObject,
} from '../shared/utils/deep-diff.ts';

export interface StoryData {
  viewMode?: string;
  storyId?: string;
  refId?: string;
}

const splitPathRegex = /\/([^/]+)\/(?:(.*)_)?([^/]+)?/;

export const parsePath: (path: string | undefined) => StoryData = memoize(1000)((
  path: string | undefined | null
) => {
  const result: StoryData = {
    viewMode: undefined,
    storyId: undefined,
    refId: undefined,
  };

  if (path) {
    const [, viewMode, refId, storyId] = path.toLowerCase().match(splitPathRegex) || [];
    if (viewMode) {
      Object.assign(result, {
        viewMode,
        storyId,
        refId,
      });
    }
  }
  return result;
});

interface Args {
  [key: string]: any;
}

// Keep this in sync with validateArgs in core-client/src/preview/parseArgsParam.ts
const VALIDATION_REGEXP = /^[a-zA-Z0-9 _-]*$/;
const NUMBER_REGEXP = /^-?[0-9]+(\.[0-9]+)?$/;
const HEX_REGEXP = /^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/i;
const COLOR_REGEXP =
  /^(rgba?|hsla?)\(([0-9]{1,3}),\s?([0-9]{1,3})%?,\s?([0-9]{1,3})%?,?\s?([0-9](\.[0-9]{1,2})?)?\)$/i;
const validateArgs = (
  key = '',
  value: unknown,
  stack: Set<object> = new Set(),
  depth = 0
): boolean => {
  if (key === null) {
    return false;
  }

  if (key === '' || !VALIDATION_REGEXP.test(key)) {
    return false;
  }

  if (value === null || value === undefined) {
    return true;
  } // encoded as `!null` or `!undefined` // encoded as `!null` or `!undefined`

  // encoded as `!null` or `!undefined`
  if (value instanceof Date) {
    return true;
  } // encoded as modified ISO string // encoded as modified ISO string

  // encoded as modified ISO string
  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'string') {
    return (
      VALIDATION_REGEXP.test(value) ||
      NUMBER_REGEXP.test(value) ||
      HEX_REGEXP.test(value) ||
      COLOR_REGEXP.test(value)
    );
  }

  // A circular value cannot be serialized into the URL, so reject it instead of recursing forever.
  if (isObject(value) && stack.has(value)) {
    return false;
  }

  // The depth guard also catches reactive proxies that return a fresh reference per access and so
  // slip past the identity cycle guard.
  if (depth >= DEEP_DIFF_MAX_DEPTH) {
    return false;
  }

  if (isObject(value)) {
    stack.add(value);
  }
  try {
    if (Array.isArray(value)) {
      return value.every((v) => validateArgs(key, v, stack, depth + 1));
    }

    if (isPlainObject(value)) {
      return Object.entries(value).every(([k, v]) => validateArgs(k, v, stack, depth + 1));
    }
    return false;
  } finally {
    if (isObject(value)) {
      stack.delete(value);
    }
  }
};

// Note this isn't a picoquery serializer because pq will turn any object
// into a nested key internally. So we need to deal witth things like `Date`
// up front.
const encodeSpecialValues = (value: unknown): unknown => {
  if (value === undefined) {
    return '!undefined';
  }

  if (value === null) {
    return '!null';
  }
  if (typeof value === 'string') {
    if (HEX_REGEXP.test(value)) {
      return `!hex(${value.slice(1)})`;
    }

    if (COLOR_REGEXP.test(value)) {
      return `!${value.replace(/[\s%]/g, '')}`;
    }
    return value;
  }

  if (typeof value === 'boolean') {
    return `!${value}`;
  }

  if (value instanceof Date) {
    return `!date(${value.toISOString()})`;
  }

  if (Array.isArray(value)) {
    return value.map(encodeSpecialValues);
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce(
      (acc, [key, val]) => Object.assign(acc, { [key]: encodeSpecialValues(val) }),
      {}
    );
  }
  return value;
};

// Replaces some url-encoded characters with their decoded equivalents.
// The URI RFC specifies these should be encoded, but all browsers will
// tolerate them being decoded, so we opt to go with it for cleaner looking
// URIs.
const decodeKnownQueryChar = (chr: string) => {
  switch (chr) {
    case '%20':
      return '+';
    case '%5B':
      return '[';
    case '%5D':
      return ']';
    case '%2C':
      return ',';
    case '%3A':
      return ':';
  }
  return chr;
};
const knownQueryChar = /%[0-9A-F]{2}/g;

/**
 * Best-effort classification of a value that is *not* a plain object/array/primitive. These
 * framework/host objects (Vue reactive proxies, React elements, DOM nodes, class instances, ...)
 * carry densely cross-linked internal graphs — often with cycles — that make `deepDiff` and
 * es-toolkit's `isEqual` recurse without bound. Returns a short label for logging, or `null` when
 * the value is safe to diff structurally.
 *
 * Property reads are wrapped in try/catch because reactive proxies and exotic objects can throw
 * from getters or traps.
 */
const getNonPlainKind = (value: unknown): string | null => {
  if (typeof value === 'function') {
    return 'function';
  }
  if (!isObject(value)) {
    return null;
  }
  // Dates are explicitly supported as args and round-trip safely, so don't flag them.
  if (value instanceof Date) {
    return null;
  }

  try {
    const obj = value;

    // Vue 3 reactivity flags (reactive/ref/readonly proxies and vnodes).
    if (obj.__v_isVNode === true) {
      return 'vue-vnode';
    }
    if (obj.__v_isRef === true) {
      return 'vue-ref';
    }
    if (obj.__v_isReactive === true || obj.__v_isReadonly === true || obj.__v_raw !== undefined) {
      return 'vue-reactive';
    }
    if (obj.$ !== undefined && obj.$el !== undefined && obj.$options !== undefined) {
      return 'vue-component-instance';
    }

    // React elements/portals/fragments, and fiber nodes.
    if (typeof obj.$$typeof === 'symbol') {
      const tag = (obj.$$typeof as symbol).description ?? '';
      return tag.startsWith('react.') ? `react-element (${tag})` : `exotic ($$typeof: ${tag})`;
    }
    if (obj.stateNode !== undefined && obj.elementType !== undefined && obj.return !== undefined) {
      return 'react-fiber';
    }

    // DOM / host objects.
    if (typeof Node !== 'undefined' && value instanceof Node) {
      return `dom-node (${(value as unknown as Node).nodeName})`;
    }
    if (typeof Window !== 'undefined' && value instanceof Window) {
      return 'window';
    }
    if (typeof Event !== 'undefined' && value instanceof Event) {
      return `dom-event (${(value as unknown as Event).type})`;
    }
    if (typeof obj.nodeType === 'number' && typeof obj.nodeName === 'string') {
      return `dom-like (${obj.nodeName})`;
    }

    // Built-ins that aren't plain objects.
    if (value instanceof Promise) {
      return 'promise';
    }
    if (value instanceof Map || value instanceof WeakMap) {
      return 'map';
    }
    if (value instanceof Set || value instanceof WeakSet) {
      return 'set';
    }
    if (value instanceof RegExp) {
      return 'regexp';
    }
    if (value instanceof Error) {
      return `error (${obj.name ?? 'Error'})`;
    }

    // Anything left that is neither a plain object nor an array is a class instance with a custom
    // prototype — also unsafe to diff blindly.
    if (!Array.isArray(value) && !isPlainObject(value)) {
      return `class-instance (${obj.constructor?.name || 'anonymous'})`;
    }
  } catch {
    return 'unreadable (threw while inspecting)';
  }

  return null;
};

interface NonPlainFinding {
  source: string;
  path: string;
  kind: string;
}

/**
 * Walks a value (args/globals) and reports any non-plain or circular sub-values that could make
 * `deepDiff` recurse unsafely. The walk is itself bounded by a cycle guard and a depth limit so the
 * diagnostic can never reproduce the very crash it's meant to surface.
 */
const scanForNonPlain = (root: unknown, source: string): NonPlainFinding[] => {
  const findings: NonPlainFinding[] = [];
  const seen = new WeakSet<object>();

  const walk = (value: unknown, path: string, depth: number): void => {
    const kind = getNonPlainKind(value);
    if (kind) {
      // Don't descend into a flagged value — that interlinked graph is exactly what we avoid.
      findings.push({ source, path: path || '<root>', kind });
      return;
    }
    if (!isObject(value)) {
      return;
    }
    if (seen.has(value)) {
      findings.push({ source, path: path || '<root>', kind: 'circular-reference' });
      return;
    }
    seen.add(value);
    if (depth >= DEEP_DIFF_MAX_DEPTH) {
      return;
    }
    try {
      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1));
      } else {
        for (const key of Object.keys(value)) {
          walk(value[key], path ? `${path}.${key}` : key, depth + 1);
        }
      }
    } catch {
      findings.push({ source, path: path || '<root>', kind: 'unreadable (threw while walking)' });
    }
  };

  walk(root, '', 0);
  return findings;
};

export const buildArgsParam = (initialArgs: Args | undefined, args: Args): string => {
  const suspects = [
    ...scanForNonPlain(initialArgs, 'initialArgs'),
    ...scanForNonPlain(args, 'args'),
  ];
  if (suspects.length > 0) {
    logger.warn(
      `[deepDiff] buildArgsParam received ${suspects.length} non-plain/circular value(s) that can make deepDiff/deepEqual recurse unbounded:`,
      suspects
    );
  }

  const update = deepDiff(initialArgs, args);

  if (!update || update === DEEPLY_EQUAL) {
    return '';
  }

  const object = Object.entries(update).reduce((acc, [key, value]) => {
    if (validateArgs(key, value)) {
      return Object.assign(acc, { [key]: value });
    }
    once.warn(dedent`
      Omitted potentially unsafe URL args.

      More info: https://storybook.js.org/docs/writing-stories/args?ref=error#setting-args-through-the-url
    `);
    return acc;
  }, {} as Args);

  return stringify(encodeSpecialValues(object), {
    delimiter: ';', // we don't actually create multiple query params
    nesting: true,
    nestingSyntax: 'js', // encode objects using dot notation: obj.key=val
  })
    .replace(knownQueryChar, decodeKnownQueryChar)
    .split(';')
    .map((part: string) => part.replace('=', ':'))
    .join(';');
};

interface Query {
  [key: string]: any;
}

const queryFromString = memoize(1000)((s?: string): Query => (s !== undefined ? parse(s) : {}));

export const queryFromLocation = (location?: Partial<Location>) => {
  return queryFromString(location?.search ? location.search.slice(1) : '');
};

export const stringifyQuery = (query: Query) => {
  const queryStr = stringify(query);
  return queryStr ? '?' + queryStr : '';
};

type Match = { path: string };

export const getMatch = memoize(1000)((
  current: string,
  target: string | RegExp,
  startsWith = true
): Match | null => {
  if (startsWith) {
    if (typeof target !== 'string') {
      throw new Error('startsWith only works with string targets');
    }
    const startsWithTarget = current && current.startsWith(target);
    if (startsWithTarget) {
      return { path: current };
    }

    return null;
  }

  const currentIsTarget = typeof target === 'string' && current === target;
  const matchTarget = current && target && current.match(target);

  if (currentIsTarget || matchTarget) {
    return { path: current };
  }

  return null;
});
