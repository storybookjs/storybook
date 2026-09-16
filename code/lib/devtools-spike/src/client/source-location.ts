/**
 * Dual-regime source resolution for the devtools spike.
 *
 * Regime 1 — React < 19.2: the JSX transform passes `__source` and React
 * exposes it as `element._source` / `fiber._debugSource`
 * ({ fileName, lineNumber, columnNumber } in original source coordinates).
 *
 * Regime 2 — React >= 19.2: `_debugSource` no longer exists. React dev builds
 * put a per-element debug value on `element._debugStack` / `fiber._debugStack`
 * (verified against react@19.2.8: the reconciler copies `element._debugStack`
 * onto the fiber in createFiberFromElement). Depending on the transform that
 * produced the JSX this is either:
 *   - the Babel source object `{ fileName, lineNumber, columnNumber }` (what
 *     @vitejs/plugin-react emits), used directly; or
 *   - a real `Error` captured at the JSX call site (react-stack-top-frame
 *     contract) whose stack frames point into the *served bundle* — these are
 *     symbolicated through the bundle's source map back to original
 *     file/line/column.
 *
 * When neither regime resolves, this module returns null — the panel renders
 * "source unknown". It never fabricates a path.
 *
 * All logic here is pure with respect to the DOM: it operates on the fiber /
 * element objects handed to it, and network access for symbolication goes
 * through the injectable `loadSource` loader, so everything is unit-testable
 * in node with synthetic fixtures.
 */

import type { SourceLocation } from '../types.ts';

/** The shape Babel's jsx-source emission and React's `_debugSource` share. */
export interface DebugSource {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

/** A frame parsed from a captured Error stack, in served-bundle coordinates. */
export interface RawStackFrame {
  url: string;
  /** 1-based line in the served (transformed) module. */
  line: number;
  /** 1-based column in the served (transformed) module. */
  column: number;
  /** The function name from the `at <name> (…)` frame, when present. */
  functionName?: string;
}

/** The slice of a source map this module consumes. */
export interface SourceMapLike {
  version: number;
  mappings: string;
  sources: string[];
  sourceRoot?: string;
  file?: string;
}

/**
 * Loads the served JavaScript for a URL (and, for external source maps, the
 * `.map` file). Returns null when the resource cannot be loaded. The default
 * implementation fetches from the dev server; tests inject fakes.
 */
export type SourceMapLoader = (url: string) => Promise<string | null>;

/**
 * Minimal structural view of a React fiber. React does not export its fiber
 * type; every field is optional because the shape drifts across React
 * versions — access is always through narrowing guards, never assumed.
 */
export interface FiberLike {
  type: unknown;
  tag?: number;
  key?: unknown;
  return?: FiberLike | null;
  child?: FiberLike | null;
  sibling?: FiberLike | null;
  _debugOwner?: FiberLike | null;
  /** React >= 19.2: source object or Error captured at JSX creation. */
  _debugStack?: unknown;
  /** React < 19.2: compiled-in JSX location. */
  _debugSource?: unknown;
  /** Props live under one of these names depending on fiber state. */
  memoizedProps?: unknown;
  pendingProps?: unknown;
  props?: unknown;
}

/** Elements may carry `_source` (React < 19.2 dev builds) — an own property React injects invisibly to the DOM types. */
export type ElementWithDebugFields = object & { _source?: unknown };

const DEBUG_WALK_LIMIT = 25;

function hasStringField<K extends string>(value: object, field: K): boolean {
  return field in value && typeof (value as Record<K, unknown>)[field] === 'string';
}

/** Narrowing guard: is this React's debug source object (both regimes' shapes)? */
export function isDebugSource(value: unknown): value is DebugSource {
  return (
    typeof value === 'object' &&
    value !== null &&
    hasStringField(value, 'fileName') &&
    'lineNumber' in value &&
    typeof (value as Record<'lineNumber', unknown>).lineNumber === 'number'
  );
}

function isErrorWithStack(value: unknown): value is { stack: string } {
  return typeof value === 'object' && value !== null && hasStringField(value, 'stack');
}

/**
 * Walks the fiber's owner chain (nearest first, mirroring React's own
 * `_debugOwner` walk when formatting owner stacks) and returns the first
 * usable debug value: a direct source object, or an Error whose stack yields
 * an application frame.
 */
export function findNearestDebugOrigin(
  fiber: FiberLike
): { kind: 'source'; source: DebugSource } | { kind: 'frame'; frame: RawStackFrame } | null {
  let current: FiberLike | null | undefined = fiber;
  for (let depth = 0; current && depth < DEBUG_WALK_LIMIT; depth += 1) {
    const debugStack: unknown = current._debugStack;
    if (isDebugSource(debugStack)) {
      return { kind: 'source', source: debugStack };
    }
    if (isErrorWithStack(debugStack)) {
      const frame = firstAppFrame(debugStack.stack);
      if (frame) {
        return { kind: 'frame', frame };
      }
    }
    current = current._debugOwner ?? current.return ?? null;
  }
  return null;
}

/** displayName ?? function name — the spec's component naming rule. */
export function componentNameOf(fiber: FiberLike): string | null {
  if (typeof fiber.type !== 'function') {
    return null;
  }
  const component = fiber.type as { displayName?: unknown; name?: unknown };
  if (typeof component.displayName === 'string' && component.displayName.length > 0) {
    return component.displayName;
  }
  return typeof component.name === 'string' && component.name.length > 0 ? component.name : null;
}

/**
 * Finds the stack frame created by the component's own render.
 *
 * A function-component fiber's `_debugStack` is the Error captured at the JSX
 * site where the component's *element* was created — i.e. the OWNER's
 * location (verified against react@19.2.8: `Button`'s fiber points at
 * App.tsx:16). The component's own render location lives one level down: the
 * `_debugStack` of the elements it rendered starts with
 * `at <ComponentName> (component-file:…)`. Walks the fiber's subtree (depth
 * first, bounded) for that frame; null when no child carries it.
 */
export function findOwnRenderFrame(fiber: FiberLike, componentName: string): RawStackFrame | null {
  let visited = 0;
  const pending: (FiberLike | null)[] = [fiber.child ?? null];
  while (pending.length > 0 && visited < DEBUG_WALK_LIMIT) {
    const current = pending.pop();
    if (!current) {
      continue;
    }
    visited += 1;
    const debugStack: unknown = current._debugStack;
    if (isErrorWithStack(debugStack)) {
      const frame = firstAppFrame(debugStack.stack);
      if (frame && frame.functionName === componentName) {
        return frame;
      }
    }
    // Children first, then siblings — depth-first order.
    pending.push(current.child ?? null, current.sibling ?? null);
  }
  return null;
}

/**
 * Reads regime 1's compiled-in location: the element's `_source` first, then
 * the fiber's `_debugSource`.
 */
export function readLegacySource(
  element: ElementWithDebugFields,
  fiber: FiberLike
): DebugSource | null {
  if (isDebugSource(element._source)) {
    return element._source;
  }
  if (isDebugSource(fiber._debugSource)) {
    return fiber._debugSource;
  }
  return null;
}

/**
 * Parses V8 stack lines into frames. Handles both `at fn (url:line:col)` and
 * bare `at url:line:col` shapes.
 */
export function parseStackFrames(stack: string): RawStackFrame[] {
  const frames: RawStackFrame[] = [];
  for (const line of stack.split('\n')) {
    // V8 frames: `at Name (url:line:col)` — or bare `at url:line:col` when
    // the function is anonymous.
    const named = line.match(/^\s*at\s+(.+?)\s+\((.+):(\d+):(\d+)\)\s*$/);
    if (named) {
      frames.push({
        url: named[2],
        line: Number(named[3]),
        column: Number(named[4]),
        functionName: named[1],
      });
      continue;
    }
    const bare = line.match(/^\s*at\s+(.+):(\d+):(\d+)\s*$/);
    if (bare) {
      frames.push({ url: bare[1], line: Number(bare[2]), column: Number(bare[3]) });
    }
  }
  return frames;
}

/** Stack URLs that never describe application code. */
function isInternalFrameUrl(url: string): boolean {
  return (
    url.includes('/node_modules/') ||
    url.includes('/@vite/client') ||
    url.startsWith('node:') ||
    url.includes('react-jsx-dev-runtime') ||
    url.includes('react_stack_bottom_frame')
  );
}

/** First stack frame that belongs to application (served) code, if any. */
export function firstAppFrame(stack: string): RawStackFrame | null {
  return parseStackFrames(stack).find((frame) => !isInternalFrameUrl(frame.url)) ?? null;
}

// ---------------------------------------------------------------------------
// Source-map symbolication (no dependencies — the client script runs in the
// browser with zero bundler-provided helpers).
// ---------------------------------------------------------------------------

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodes one comma-free VLQ segment into its signed numbers. */
export function decodeVlqSegment(segment: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  for (const char of segment) {
    const digit = BASE64_ALPHABET.indexOf(char);
    if (digit < 0) {
      throw new Error(`invalid base64 VLQ character: ${char}`);
    }
    value += (digit & 31) * 2 ** shift;
    shift += 5;
    if (!(digit & 32)) {
      const negative = (value & 1) === 1;
      value = Math.floor(value / 2);
      values.push(negative ? -value : value);
      value = 0;
      shift = 0;
    }
  }
  return values;
}

interface DecodedMapping {
  generatedColumn: number;
  sourceIndex?: number;
  sourceLine?: number;
  sourceColumn?: number;
}

/** Decodes a `mappings` string into per-generated-line segment lists. */
export function decodeMappings(mappings: string): DecodedMapping[][] {
  const lines: DecodedMapping[][] = [];
  let sourceIndex = 0;
  let sourceLine = 0;
  let sourceColumn = 0;
  for (const lineStr of mappings.split(';')) {
    let generatedColumn = 0;
    const segments: DecodedMapping[] = [];
    if (lineStr.length > 0) {
      for (const segment of lineStr.split(',')) {
        const values = decodeVlqSegment(segment);
        if (values.length === 0) {
          continue;
        }
        generatedColumn += values[0];
        if (values.length >= 4) {
          sourceIndex += values[1];
          sourceLine += values[2];
          sourceColumn += values[3];
          segments.push({ generatedColumn, sourceIndex, sourceLine, sourceColumn });
        } else {
          segments.push({ generatedColumn });
        }
      }
    }
    lines.push(segments);
  }
  return lines;
}

export interface OriginalPosition {
  source: string;
  /** 1-based, for display. */
  line: number;
  /** 1-based, for display. */
  column: number;
}

/**
 * Maps a generated position (0-based line and column, source-map convention)
 * to the original position via the nearest preceding same-line mapping.
 * Returns null when the line has no source mapping at or before the column —
 * this must surface as "source unknown", never a guessed position.
 */
export function originalPositionFor(
  map: SourceMapLike,
  generated: { line: number; column: number }
): OriginalPosition | null {
  const lines = decodeMappings(map.mappings);
  const segments = lines[generated.line];
  if (!segments || segments.length === 0) {
    return null;
  }
  let match: DecodedMapping | undefined;
  for (const segment of segments) {
    if (segment.generatedColumn <= generated.column) {
      match = segment;
    } else {
      break;
    }
  }
  if (!match || match.sourceIndex === undefined) {
    return null;
  }
  const source = map.sources[match.sourceIndex];
  if (typeof source !== 'string') {
    return null;
  }
  return {
    source: resolveMapSource(map, source),
    line: (match.sourceLine ?? 0) + 1,
    column: (match.sourceColumn ?? 0) + 1,
  };
}

function resolveMapSource(map: SourceMapLike, source: string): string {
  if (map.sourceRoot) {
    return `${map.sourceRoot.replace(/\/$/, '')}/${source.replace(/^\.\//, '')}`;
  }
  if (source.startsWith('/') || /^[a-z]+:/i.test(source)) {
    return source;
  }
  const base = map.file ?? '';
  if (!base.includes('/')) {
    return source;
  }
  // file may be an absolute path or file: URL; URL resolution handles both
  // relative sources against its directory.
  try {
    return new URL(source, base.startsWith('file:') ? base : `file://${base}`).pathname;
  } catch {
    return source;
  }
}

/**
 * The map located inside a served module: inlined as a data URL, referenced
 * externally, or absent.
 */
type LocatedSourceMap =
  | { kind: 'inline'; map: SourceMapLike }
  | { kind: 'external'; mapUrl: string }
  | null;

function extractSourceMapJson(js: string): LocatedSourceMap {
  const marker = '//# sourceMappingURL=';
  const index = js.lastIndexOf(marker);
  if (index === -1) {
    return null;
  }
  const mapUrl = js
    .slice(index + marker.length)
    .split('\n')[0]
    .trim();
  try {
    if (mapUrl.startsWith('data:')) {
      const commaIndex = mapUrl.indexOf(',');
      if (commaIndex === -1) {
        return null;
      }
      const payload = mapUrl.slice(commaIndex + 1);
      const decoded = isBase64Payload(mapUrl.slice(5, commaIndex))
        ? typeof Buffer !== 'undefined'
          ? Buffer.from(payload, 'base64').toString('utf8')
          : atob(payload)
        : decodeURIComponent(payload);
      const map = parseSourceMapJson(decoded);
      return map ? { kind: 'inline', map } : null;
    }
    return { kind: 'external', mapUrl };
  } catch (error) {
    console.warn('[sb-devtools] failed to parse source map', mapUrl, error);
    return null;
  }
}

function isBase64Payload(mimeType: string): boolean {
  return mimeType.includes('base64');
}

export function parseSourceMapJson(json: string): SourceMapLike | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      hasStringField(parsed, 'mappings') &&
      Array.isArray((parsed as Record<'sources', unknown>).sources)
    ) {
      const record = parsed as Record<string, unknown>;
      return {
        version: typeof record.version === 'number' ? record.version : -1,
        mappings: record.mappings as string,
        sources: record.sources as string[],
        sourceRoot: typeof record.sourceRoot === 'string' ? record.sourceRoot : undefined,
        file: typeof record.file === 'string' ? record.file : undefined,
      };
    }
    return null;
  } catch (error) {
    console.warn('[sb-devtools] source map is not valid JSON', error);
    return null;
  }
}

/**
 * Symbolicates a served-bundle frame through its source map. Requires the
 * transformed module text so the inline (or external) map can be located.
 */
export async function symbolicateFrame(
  frame: RawStackFrame,
  loadSource: SourceMapLoader
): Promise<SourceLocation | null> {
  const js = await loadSource(frame.url);
  if (js === null) {
    return null;
  }
  const located = extractSourceMapJson(js);
  let map: SourceMapLike | null;
  if (located === null) {
    map = null;
  } else if (located.kind === 'inline') {
    map = located.map;
  } else {
    const mapUrl = new URL(located.mapUrl, frame.url).toString();
    const mapJson = await loadSource(mapUrl);
    map = mapJson === null ? null : parseSourceMapJson(mapJson);
  }
  if (!map) {
    return null;
  }
  const position = originalPositionFor(map, { line: frame.line - 1, column: frame.column - 1 });
  if (!position) {
    return null;
  }
  return {
    file: relativizeWorkspacePath(position.source),
    line: position.line,
    column: position.column,
    regime: 'componentStack',
  };
}

/**
 * Renders absolute repo paths workspace-relative (the type's contract). Paths
 * outside the workspace are shown as-is — never rewritten to look local.
 */
export function relativizeWorkspacePath(file: string): string {
  const marker = '/code/';
  const index = file.lastIndexOf(marker);
  if (index !== -1) {
    return file.slice(index + 1);
  }
  return file;
}

const defaultLoadSource: SourceMapLoader = (url) =>
  fetch(url)
    .then((response) => (response.ok ? response.text() : null))
    .catch((error: unknown) => {
      console.warn('[sb-devtools] failed to load source for symbolication', url, error);
      return null;
    });

/**
 * The dual-regime resolver. Resolves the source location of the element the
 * given fiber was created from, or null when no regime can resolve it.
 */
export async function resolveSource(
  fiber: FiberLike,
  element: ElementWithDebugFields,
  loadSource: SourceMapLoader = defaultLoadSource
): Promise<SourceLocation | null> {
  // Regime 1 — React < 19.2: compiled-in JSX location.
  const legacy = readLegacySource(element, fiber);
  if (legacy) {
    return {
      file: relativizeWorkspacePath(legacy.fileName),
      line: legacy.lineNumber,
      column: legacy.columnNumber ?? 0,
      regime: 'debugSource',
    };
  }
  // Regime 2 — React >= 19.2: component-stack debug data. Prefer the frame
  // created by the component's own render (its file is where the story is
  // written); fall back to the element-creation walk when no child carries
  // the component's frame.
  const componentName = componentNameOf(fiber);
  const ownFrame = componentName ? findOwnRenderFrame(fiber, componentName) : null;
  if (ownFrame) {
    return symbolicateFrame(ownFrame, loadSource);
  }
  const origin = findNearestDebugOrigin(fiber);
  if (!origin) {
    return null;
  }
  if (origin.kind === 'source') {
    return {
      file: relativizeWorkspacePath(origin.source.fileName),
      line: origin.source.lineNumber,
      column: origin.source.columnNumber ?? 0,
      regime: 'componentStack',
    };
  }
  return symbolicateFrame(origin.frame, loadSource);
}
