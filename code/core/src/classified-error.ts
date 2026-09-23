import { appendErrorRef } from './storybook-error.ts';

/**
 * The two severity tiers of the error anatomy. `negative` for every recoverable failure on a
 * surface; `critical` only for crashes — a test run that died, a manager-level fault.
 */
export type ErrorSeverity = 'negative' | 'critical';

/**
 * The failure classes of the error anatomy. Every error maps to exactly one kind; the mapping is
 * decided only by {@link classifyError} — downstream surfaces consume {@link ClassifiedError} and
 * never re-derive kind or severity.
 */
export type ErrorKind =
  | 'render-exception' // the story function or its render threw, uncaught by an app layer
  | 'story-not-found' // story specifier/HMR match failure or empty index
  | 'app-config' // controlled showError from an app layer, or preview/config failure
  | 'dependency' // a dependent surface cannot run because an upstream failure blocks it
  | 'manager-crash'; // test runner or manager-level fatal

/**
 * Where an error entered the UI: the emitting path of the audited throw sites, not the surface.
 * One emit site per value:
 *
 * - `story-render` — `PreviewWithSelection.renderException` (`STORY_THREW_EXCEPTION`)
 * - `story-missing` — `renderStoryLoadingException` / `renderMissingStory` (`STORY_MISSING`)
 * - `app-layer` — `renderError`, the controlled `showError` from an app layer (`STORY_ERRORED`)
 * - `config` — `renderPreviewEntryError` (`CONFIG_ERROR`) / preview entry failure
 * - `dependency` — a dependent panel reporting an upstream failure blocking it
 * - `manager` — the manager error boundary or a test-runner fatal
 */
export type ErrorSource =
  | 'story-render'
  | 'story-missing'
  | 'app-layer'
  | 'config'
  | 'dependency'
  | 'manager';

/** A parsed stack frame, in the shape the code-frame anatomy renders. */
export interface CodeFrame {
  file: string;
  line: number;
  column?: number;
  /** Raw stack context around the caret, trimmed. Falls back to raw frame lines. */
  lines: string[];
  caret: { line: number; column: number };
}

/**
 * The single error contract every surface renders. Produced only by {@link classifyError};
 * surfaces never compose their own copy or parse stack strings.
 */
export interface ClassifiedError {
  severity: ErrorSeverity;
  kind: ErrorKind;
  /** Plain-language what — never the raw message. */
  title: string;
  /** Why, only when known and trustworthy. */
  cause?: string;
  /** The raw message, verbatim. */
  message: string;
  codeFrame?: CodeFrame;
  stack?: string;
  /** React component stack; only the manager boundary produces one. */
  componentStack?: string;
  /** Structured id, e.g. `SB_PREVIEW_API_0009`, rendered as small print. */
  errorCode?: string;
  /** The error's own documentation URL, when attached at throw time. */
  docsUrl?: string;
  /** Vitest integration only. */
  testPath?: string;
  testLocation?: { file: string; line: number; column: number; method?: string };
}

/** Optional details from the emitting path, used to sharpen the title and diagnostics. */
export interface ErrorContext {
  storyId?: string;
  storyName?: string;
  /** What matched nothing, for `story-missing`. */
  specifier?: string;
  componentStack?: string;
  testPath?: string;
  testLocation?: { file: string; line: number; column: number; method?: string };
}

const KIND_BY_SOURCE: Record<ErrorSource, ErrorKind> = {
  'story-render': 'render-exception',
  'story-missing': 'story-not-found',
  'app-layer': 'app-config',
  config: 'app-config',
  dependency: 'dependency',
  manager: 'manager-crash',
};

const GENERIC_TITLES: Record<ErrorKind, string> = {
  'render-exception': 'The story failed to render.',
  'story-not-found': 'The story could not be found.',
  'app-config': 'The story could not be displayed.',
  dependency: 'This story failed to render.',
  'manager-crash': 'Something went wrong.',
};

/**
 * StorybookError detection without `instanceof`, which misclassifies across bundle copies. Uses
 * the `fromStorybook` trait property — the same pattern `StorybookError.agentFacing` documents.
 */
export interface StorybookErrorLike {
  readonly category: string;
  readonly code: number;
  readonly documentation: boolean | string | string[];
  readonly fullErrorCode: string;
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
}

const isStorybookErrorLike = (error: unknown): error is StorybookErrorLike => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'fromStorybook' in error &&
    (error as { fromStorybook?: unknown }).fromStorybook === true
  );
};

function readStringProp(error: unknown, prop: string): string | undefined {
  if (typeof error === 'object' && error !== null && prop in error) {
    const value: unknown = (error as Record<string, unknown>)[prop];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

/**
 * Structured metadata from a `StorybookError`, for forwarding through preview error events. Empty
 * for any other error. Array documentation stays embedded in the message, so no single URL is
 * surfaced.
 */
export interface StorybookErrorMetadata {
  category?: string;
  errorCode?: string;
  docsUrl?: string;
}

export function getErrorMetadata(error: unknown): StorybookErrorMetadata {
  if (!isStorybookErrorLike(error)) {
    return {};
  }
  const metadata: StorybookErrorMetadata = {
    category: error.category,
    errorCode: error.fullErrorCode,
  };
  if (error.documentation === true) {
    // Same URL `StorybookError.getFullMessage` composes for `documentation: true`.
    metadata.docsUrl = `https://storybook.js.org/error/${error.fullErrorCode}?ref=error`;
  } else if (typeof error.documentation === 'string') {
    metadata.docsUrl = appendErrorRef(error.documentation);
  }
  return metadata;
}

// Location at the end of a frame line: `path:line:column` or `path:line`, wrapped in optional
// parens. One pair of regexes covers Chromium (`at fn (url:1:2)`), Firefox/Safari (`fn@url:1:2`)
// and source-mapped CLI stacks (`at /repo/src/file.tsx:57:16`). The strict `line:column` form is
// tried first so the greedy path group cannot swallow the line number.
const frameLocationRegex = /\(?([^()@\s]+):(\d+):(\d+)\)?$/;
const frameLocationNoColumnRegex = /\(?([^()@\s]+):(\d+)\)?$/;

function parseCodeFrame(stack: string): CodeFrame | undefined {
  for (const rawLine of stack.split('\n')) {
    const line = rawLine.trim();
    // Frame lines either start with `at ` (Chromium) or carry `@` (Firefox/Safari); this keeps
    // message header lines from being mistaken for frames.
    if (!line.startsWith('at ') && !line.includes('@')) {
      continue;
    }
    const match = line.match(frameLocationRegex);
    const noColumnMatch = match ? undefined : line.match(frameLocationNoColumnRegex);
    const location = match ?? noColumnMatch;
    if (!location) {
      continue;
    }
    let file = location[1];
    const origin = globalThis.location?.origin;
    if (origin && file.startsWith(origin)) {
      file = file.slice(origin.length);
    }
    const line_ = Number(location[2]);
    const column = match ? Number(match[3]) : undefined;
    return {
      file,
      line: line_,
      ...(column === undefined ? {} : { column }),
      lines: [rawLine],
      caret: { line: line_, column: column ?? 0 },
    };
  }
  return undefined;
}

function getTitle(kind: ErrorKind, source: ErrorSource, error: unknown, context: ErrorContext) {
  if (source === 'app-layer') {
    // App layers pass a composed human title via `showError({ title, description })`.
    const appTitle = readStringProp(error, 'title');
    if (appTitle) {
      return appTitle;
    }
  }
  const name = context.storyName ?? context.storyId;
  if (kind === 'render-exception' && name) {
    return `The ${name} story failed to render.`;
  }
  return GENERIC_TITLES[kind];
}

/**
 * The only place kind and severity are decided. Producers declare where the error entered the UI
 * (the emitting path); surfaces consume the returned {@link ClassifiedError} and render it.
 */
export function classifyError(
  error: unknown,
  source: ErrorSource,
  context: ErrorContext = {}
): ClassifiedError {
  const kind = KIND_BY_SOURCE[source];
  const severity: ErrorSeverity = kind === 'manager-crash' ? 'critical' : 'negative';

  const storybookError = isStorybookErrorLike(error) ? error : undefined;
  const { errorCode, docsUrl } = getErrorMetadata(error);
  const appDescription = source === 'app-layer' ? readStringProp(error, 'description') : undefined;
  const message =
    readStringProp(error, 'message') ??
    appDescription ??
    (error == null || error === '' ? 'Unknown error' : String(error));
  const stack =
    readStringProp(error, 'stack') ?? (storybookError ? storybookError.stack : undefined);

  return {
    severity,
    kind,
    title: getTitle(kind, source, error, context),
    message,
    ...(stack ? { stack, codeFrame: parseCodeFrame(stack) } : {}),
    ...(context.componentStack ? { componentStack: context.componentStack } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(docsUrl ? { docsUrl } : {}),
    ...(context.testPath ? { testPath: context.testPath } : {}),
    ...(context.testLocation ? { testLocation: context.testLocation } : {}),
  };
}
