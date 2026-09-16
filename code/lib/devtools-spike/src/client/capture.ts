/**
 * Client capture transport: build the CapturePayload from live fiber props,
 * POST it to the dev-server middleware, and parse the response contract.
 * Failures throw with the server's message and attempted file path — capture
 * never fails silently.
 */

import type {
  CapturedProp,
  CapturePayload,
  FlaggedProp,
  UnserializableSentinel,
} from '../types.ts';

export const CAPTURE_ENDPOINT = '/__sb-devtools/capture';

export type CapturePoster = (
  endpoint: string,
  payload: CapturePayload
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const defaultPost: CapturePoster = (endpoint, payload) =>
  fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

/**
 * A capture request that the middleware rejected. Carries the attempted story
 * file path (when the server knows it) so the panel can show what failed.
 */
export class CaptureResponseError extends Error {
  constructor(
    message: string,
    readonly filePath?: string
  ) {
    super(message);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isReactElement = (value: object): boolean =>
  '$$typeof' in value && 'props' in value && 'type' in value;

const isPlainObject = (value: object): boolean => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Client-side classification of one captured prop: serializable kinds carry
 * their raw value (the node side deep-inspects and flags nested problems);
 * everything else carries only a display preview.
 */
export function classifyProp(name: string, value: unknown): CapturedProp {
  if (value === undefined) {
    return { name, kind: 'unknown' };
  }
  switch (typeof value) {
    case 'function':
      return {
        name,
        kind: 'function',
        preview: `ƒ ${value.name.length > 0 ? value.name : 'anonymous'}`,
      };
    case 'symbol': {
      const symbolDescription = value.description ?? '';
      return {
        name,
        kind: 'symbol',
        preview: symbolDescription.length > 0 ? `Symbol(${symbolDescription})` : 'Symbol()',
      };
    }
    case 'bigint':
      return { name, kind: 'unknown', preview: `${value}n` };
    case 'object': {
      if (value === null) {
        return { name, kind: 'primitive', value: null };
      }
      if (Array.isArray(value)) {
        return { name, kind: 'array', value: sanitizeContainerValue(value) };
      }
      if (isReactElement(value)) {
        const type = (value as Record<'type', unknown>).type;
        const label =
          typeof type === 'function' && typeof (type as { name?: unknown }).name === 'string'
            ? (type as { name: string }).name
            : typeof type === 'string'
              ? type
              : 'element';
        return { name, kind: 'unknown', preview: `<${label} />` };
      }
      if (!isPlainObject(value)) {
        const ctorName = (value as { constructor?: { name?: unknown } }).constructor?.name;
        return {
          name,
          kind: 'class-instance',
          preview: `${typeof ctorName === 'string' && ctorName.length > 0 ? ctorName : 'anonymous'} {…}`,
        };
      }
      return { name, kind: 'object', value: sanitizeContainerValue(value) };
    }
    default:
      // string | number | boolean
      return { name, kind: 'primitive', value };
  }
}

const elementLabel = (value: object): string => {
  const type = (value as Record<'type', unknown>).type;
  if (typeof type === 'function' && typeof (type as { name?: unknown }).name === 'string') {
    return `<${type.name} />`;
  }
  return typeof type === 'string' ? `<${type} />` : 'a React element';
};

const sentinel = (
  kind: UnserializableSentinel['__sbDevtools'],
  label: string
): UnserializableSentinel => ({ __sbDevtools: kind, label });

/**
 * Replaces values that cannot cross JSON with tagged sentinels, recursively
 * for containers. Live props reach here raw — React elements carry circular
 * fiber references that would make JSON.stringify throw, and nested
 * functions/undefined would be dropped or corrupted silently. The node-side
 * serializer maps sentinels back to precise flagged-props.
 */
export function sanitizeContainerValue(value: unknown, ancestors: readonly object[] = []): unknown {
  if (typeof value === 'function') {
    const name = (value as { name?: unknown }).name;
    return sentinel(
      'function',
      `a function${typeof name === 'string' && name.length > 0 ? ` (ƒ ${name})` : ''}`
    );
  }
  if (typeof value === 'symbol') {
    return sentinel('symbol', `a symbol${value.description ? ` (${value.description})` : ''}`);
  }
  if (typeof value === 'bigint') {
    return sentinel('bigint', `the bigint ${value}n`);
  }
  if (typeof value === 'undefined') {
    return sentinel('unknown', 'an undefined value');
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return sentinel('unknown', `the non-finite number ${value}`);
  }
  if (typeof value !== 'object' || value === null) {
    return value; // string | number | boolean — JSON-safe as-is
  }
  if (isReactElement(value)) {
    return sentinel('react-element', elementLabel(value));
  }
  if (ancestors.includes(value)) {
    return sentinel('unknown', 'a circular reference');
  }
  const seen = [...ancestors, value];
  if (Array.isArray(value)) {
    return value.map((element) => sanitizeContainerValue(element, seen));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, sanitizeContainerValue(child, seen)])
    );
  }
  const ctorName = (value as { constructor?: { name?: unknown } }).constructor?.name;
  return sentinel(
    'class-instance',
    `a ${typeof ctorName === 'string' && ctorName.length > 0 ? ctorName : 'anonymous'} class instance`
  );
}

/**
 * Builds the capture payload from the hovered component's live props —
 * the values the component actually rendered with (fiber memoized props).
 */
export function buildCapturePayload(input: {
  componentName: string;
  source: CapturePayload['source'];
  props: unknown;
  reactVersion: string;
}): CapturePayload {
  const props =
    typeof input.props === 'object' && input.props !== null
      ? Object.entries(input.props as Record<string, unknown>).map(([name, value]) =>
          classifyProp(name, value)
        )
      : [];
  return {
    componentName: input.componentName,
    source: input.source,
    props,
    reactVersion: input.reactVersion,
    capturedAt: Date.now(),
  };
}

/**
 * Boundary parse of the middleware's response: failure shapes throw
 * (CaptureResponseError — the panel renders them as a write-failure error),
 * success shapes are validated field-by-field before the panel trusts them.
 */
export function parseCaptureResponse(json: unknown): {
  storyId: string;
  storyName: string;
  filePath: string;
  flagged: FlaggedProp[];
} {
  if (!isRecord(json)) {
    throw new CaptureResponseError('Malformed capture response');
  }
  if (typeof json.error === 'string') {
    throw new CaptureResponseError(
      typeof json.message === 'string' ? json.message : 'Story generation failed',
      typeof json.filePath === 'string' ? json.filePath : undefined
    );
  }
  if (
    typeof json.storyId !== 'string' ||
    json.storyId.length === 0 ||
    typeof json.storyName !== 'string' ||
    typeof json.filePath !== 'string' ||
    !Array.isArray(json.flagged)
  ) {
    throw new CaptureResponseError('Malformed capture response');
  }
  const flaggedReasons = ['function', 'class-instance', 'symbol', 'unknown'];
  const flagged: FlaggedProp[] = [];
  for (const entry of json.flagged) {
    if (
      !isRecord(entry) ||
      typeof entry.name !== 'string' ||
      typeof entry.reason !== 'string' ||
      !flaggedReasons.includes(entry.reason) ||
      typeof entry.guidance !== 'string'
    ) {
      throw new CaptureResponseError('Malformed flagged prop in capture response');
    }
    flagged.push({
      name: entry.name,
      reason: entry.reason as FlaggedProp['reason'],
      guidance: entry.guidance,
    });
  }
  return {
    storyId: json.storyId,
    storyName: json.storyName,
    filePath: json.filePath,
    flagged,
  };
}

/**
 * Sends the capture payload. Rejections carry the server's failure contract
 * (message + attempted path) so the panel can surface exactly what failed.
 */
export async function captureComponent(
  payload: CapturePayload,
  post: CapturePoster = defaultPost
): Promise<ReturnType<typeof parseCaptureResponse>> {
  const response = await post(CAPTURE_ENDPOINT, payload);
  const body: unknown = await response.json();
  if (!response.ok) {
    if (isRecord(body) && typeof body.error === 'string') {
      throw new CaptureResponseError(
        typeof body.message === 'string' ? body.message : `capture failed: ${response.status}`,
        typeof body.filePath === 'string' ? body.filePath : undefined
      );
    }
    throw new CaptureResponseError(`capture failed: ${response.status}`);
  }
  return parseCaptureResponse(body);
}
