/**
 * Client capture transport: build the CapturePayload from live fiber props,
 * POST it to the dev-server middleware, and parse the response contract.
 * Failures throw with the server's message and attempted file path — capture
 * never fails silently.
 */

import type { CapturedProp, CapturePayload, FlaggedProp } from '../types.ts';

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
    case 'symbol':
      return {
        name,
        kind: 'symbol',
        preview: value.description.length > 0 ? `Symbol(${value.description})` : 'Symbol()',
      };
    case 'bigint':
      return { name, kind: 'unknown', preview: `${value}n` };
    case 'object': {
      if (value === null) {
        return { name, kind: 'primitive', value: null };
      }
      if (Array.isArray(value)) {
        return { name, kind: 'array', value };
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
      return { name, kind: 'object', value };
    }
    default:
      // string | number | boolean
      return { name, kind: 'primitive', value };
  }
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
