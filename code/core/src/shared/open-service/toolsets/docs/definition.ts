import * as v from 'valibot';

import { defineToolset, type ToolsetCtx, type ToolsetOutcome } from '../../toolset-definition.ts';
import { getToolName, type ToolsetMethodId } from '../../toolset-names.ts';
import { listEntryNames, type DocsAccess, type ResolvedDocsEntry } from './access.ts';
import {
  formatComponentManifest,
  formatDocsManifest,
  formatManifestsToLists,
  formatMultiSourceManifestsToLists,
  formatSourceIndex,
  formatStoryDocumentation,
  MAX_STORIES_TO_SHOW,
} from './manifest-formatter/markdown.ts';
import type { AllManifests } from './manifest-formatter/manifest-types.ts';
import {
  pageListing,
  readListRequest,
  type ListQuery,
  type ListRequest,
  type ListSection,
} from './list-page.ts';
import { listSources, type DocsSource } from './multi-source.ts';
import { RequiresOwnMcpError, type SourceListing } from './sources.ts';
import { suggestEntries, type DocsListedEntry } from './suggest.ts';
import { estimateTokens } from '../estimate-tokens.ts';

const DOCS_TOOLSET_ID = 'docs';
const DOCS_METHOD_NAMES = {
  list: 'list',
  show: 'show',
  showStory: 'showStory',
} as const;
const DOCS_METHOD_REFS = {
  list: `${DOCS_TOOLSET_ID}.${DOCS_METHOD_NAMES.list}`,
  show: `${DOCS_TOOLSET_ID}.${DOCS_METHOD_NAMES.show}`,
  showStory: `${DOCS_TOOLSET_ID}.${DOCS_METHOD_NAMES.showStory}`,
} as const satisfies Record<'list' | 'show' | 'showStory', ToolsetMethodId>;

/**
 * Which Storybooks these tools serve — exactly one of the two.
 *
 * Modelled as an exclusive union so neither "no access at all" nor "both, one silently winning" can
 * be constructed: a composition takes a `storybookId` on every lookup and a single Storybook must
 * not ask for one, and that difference is decided here.
 */
export type CreateDocsToolsetOptions =
  | {
      /** Reads the one Storybook these tools serve. */
      docsAccess: DocsAccess;
      sources?: never;
    }
  | {
      /** The composed Storybooks these tools serve; ids are only unique within a source. */
      sources: DocsSource[];
      docsAccess?: never;
    };

// Under Claude Code's default 25,000-token cap on MCP tool output, with room for estimateTokens
// counting fewer characters per token than a model tokenizer.
const LIST_PAGE_TOKEN_BUDGET = 20_000;

export type DocsListOutput = {
  withStoryIds: boolean;
  /** Single-source listing: the entries on this page. */
  manifests?: AllManifests;
  /** Per-source listings, in composition: the sources on this page, each with the entries on it. */
  sources?: SourceListing[];
  /** The sources the listing was narrowed to. */
  storybookIds?: string[];
  /** Pass it as `cursor` to get the next page. Absent on the last page. */
  nextCursor?: string;
};

/** Why `docs.list` listed nothing. */
export type DocsListRefusal =
  | { kind: 'unknown-sources'; unknown: string[]; available: string[] }
  | { kind: 'cursor-unreadable' }
  | { kind: 'cursor-conflict' }
  | { kind: 'cursor-stale'; query: ListQuery };

export type DocsListFailure = { refusal: DocsListRefusal };

type Listing<TSection extends ListSection> = {
  sections: TSection[];
  keyOf: (section: TSection) => string | undefined;
  format: (sections: TSection[]) => string;
  index?: () => string;
  toData: (sections: TSection[]) => Pick<DocsListOutput, 'manifests' | 'sources'>;
};

export type DocsShowOutput = {
  id: string;
  entry?: ResolvedDocsEntry;
  /** The source that was asked. */
  storybookId?: string;
  /** The source the entry came from, set only when that is not the one that was asked. */
  resolvedStorybookId?: string;
  /** Listed entries close to an `id` that resolved to nothing. */
  suggestions?: DocsListedEntry[];
  /** Sources a miss could not search, with the reason: the id may still be in one of them. */
  unreadableSources?: { storybookId: string; error: string }[];
  /** Set when the request named no source, or one that does not exist. */
  sourceError?: string;
  /** Set when the named source can only be read through its own MCP endpoint. */
  notice?: string;
};

export type DocsShowStoryOutput = {
  componentId?: string;
  storyName?: string;
  storyId?: string;
  entry?: ResolvedDocsEntry;
  storybookId?: string;
  /** The source the component came from, set only when that is not the one that was asked. */
  resolvedStorybookId?: string;
  sourceError?: string;
  notice?: string;
};

/**
 * The manifests a listing should be reported against.
 *
 * Reporting predates composition and describes one Storybook, so a composed listing is reported
 * against the first source that produced one. Nothing is returned when no source did — a listing of
 * nothing but errors is not a usage signal.
 */
export function selectReportedManifests({
  manifests,
  sources,
}: DocsListOutput): AllManifests | undefined {
  return manifests ?? sources?.find((listing) => listing.manifests)?.manifests;
}

/**
 * One classification of a `show` lookup, shared by the failure predicate and the renderer so the
 * outcome tag and the rendered prose cannot disagree.
 */
type ShowResolution =
  | { kind: 'source-error'; message: string }
  | { kind: 'notice'; message: string }
  | { kind: 'entry-missing' }
  | { kind: 'found'; entry: ResolvedDocsEntry };

function resolveShow({ entry, sourceError, notice }: DocsShowOutput): ShowResolution {
  if (sourceError !== undefined) {
    return { kind: 'source-error', message: sourceError };
  }
  if (notice !== undefined) {
    return { kind: 'notice', message: notice };
  }
  if (entry === undefined) {
    return { kind: 'entry-missing' };
  }
  return { kind: 'found', entry };
}

type ComponentEntry = Extract<ResolvedDocsEntry, { kind: 'component' }>;
type ComponentStory = NonNullable<ComponentEntry['component']['stories']>[number];

/** The `showStory` counterpart of {@link ShowResolution}. */
type ShowStoryResolution =
  | { kind: 'input-invalid' }
  | { kind: 'source-error'; message: string }
  | { kind: 'notice'; message: string }
  | { kind: 'component-missing' }
  | { kind: 'story-missing'; component: ComponentEntry['component'] }
  | { kind: 'found'; component: ComponentEntry['component']; story: ComponentStory };

/** Whether a `showStory` input names a story at all: a story id, or a complete name pair. */
function isShowStorySelector({ storyId, componentId, storyName }: DocsShowStoryOutput): boolean {
  return storyId !== undefined || (componentId !== undefined && storyName !== undefined);
}

/**
 * The component id a story id starts with (`button--primary` → `button`). Only a routing hint for
 * which manifest entry to resolve — a match is reported solely when a story's `id` equals the
 * input.
 */
function componentIdOfStoryId(storyId: string): string {
  const separator = storyId.indexOf('--');
  return separator === -1 ? storyId : storyId.slice(0, separator);
}

function resolveShowStory(data: DocsShowStoryOutput): ShowStoryResolution {
  const { entry, storyId, storyName, sourceError, notice } = data;
  if (!isShowStorySelector(data)) {
    return { kind: 'input-invalid' };
  }
  if (sourceError !== undefined) {
    return { kind: 'source-error', message: sourceError };
  }
  if (notice !== undefined) {
    return { kind: 'notice', message: notice };
  }
  if (entry === undefined || entry.kind !== 'component') {
    return { kind: 'component-missing' };
  }
  const { component } = entry;
  const story =
    storyId !== undefined
      ? component.stories?.find((candidate) => candidate.id === storyId)
      : component.stories?.find((candidate) => candidate.name === storyName);
  return story ? { kind: 'found', component, story } : { kind: 'story-missing', component };
}

/**
 * Whether `docs.show` failed: an unusable source, or an id that resolved to nothing.
 *
 * The handlers encode this in the outcome tag; the predicate stays exported because it is part of
 * the frozen `@storybook/mcp` API.
 */
export function isDocsShowError(output: DocsShowOutput): boolean {
  const { kind } = resolveShow(output);
  return kind !== 'found' && kind !== 'notice';
}

/** Whether `docs.showStory` failed: an unusable source, a missing component, or a missing story. */
export function isDocsShowStoryError(output: DocsShowStoryOutput): boolean {
  const { kind } = resolveShowStory(output);
  return kind !== 'found' && kind !== 'notice';
}

function describeList(ctx: ToolsetCtx): string {
  return `List all available UI components and documentation entries from the Storybook, returning the IDs the other documentation tools take as input. Call this first for any UI task — before writing a new component, check what the design system already provides and build on it instead of hand-rolling a duplicate; before answering any question about props, API, or usage, discover the relevant IDs here rather than reading component source. Then fetch the entries with ${getToolName(ctx)(DOCS_METHOD_REFS.show)}, referencing only IDs returned here — never guess IDs. When multiple Storybook sources are configured, entries from every source are included; pass storybookIds to list only some of them, and scope follow-up calls to one source via their storybookId input. A listing too long for one result comes in pages: the first page of a composition opens with an index of every source, and each page that has a next one ends with the ready-to-run call for it, which passes its nextCursor as cursor. Pass withStoryIds: true only when you need the story IDs of many components; the show tool already lists the story IDs of one component.`;
}

function describeShow(ctx: ToolsetCtx): string {
  return `Get documentation for a UI component or docs entry.

Returns the first ${MAX_STORIES_TO_SHOW} stories (including story IDs) with code snippets showing how props are used, plus TypeScript prop definitions. Call this before using a component to avoid hallucinating prop names, types, or valid combinations, and to answer any question about a component's props, API, or usage — reading or grepping the component source is not a substitute. Stories reveal real prop usage patterns, interactions, and edge cases that type definitions alone don't show. If the example stories don't show the prop you need, use the ${getToolName(ctx)(DOCS_METHOD_REFS.showStory)} tool to fetch the story documentation for the specific story variant you need — its story ID can be passed directly as storyId.

Example: id="button" returns Primary, Secondary, Large stories with code like <Button variant="primary" size="large"> showing actual prop combinations.`;
}

function formatCall(
  method: ToolsetMethodId,
  args: Record<string, string | boolean | string[] | undefined>,
  ctx: ToolsetCtx
): string {
  const tool = getToolName(ctx)(method);
  const given = Object.entries(args).filter(
    (entry): entry is [string, string | true | string[]] =>
      entry[1] !== undefined && entry[1] !== false
  );
  if (ctx.transport !== 'cli') {
    return `${tool} ${JSON.stringify(Object.fromEntries(given))}`;
  }
  return [
    tool,
    ...given.map(([key, value]) =>
      value === true
        ? `--${key}`
        : typeof value === 'string'
          ? `--${key} ${value}`
          : `--${key} '${JSON.stringify(value)}'`
    ),
  ].join(' ');
}

function formatShowCall({ id, storybookId }: DocsListedEntry, ctx: ToolsetCtx) {
  return formatCall(DOCS_METHOD_REFS.show, { id, storybookId }, ctx);
}

function formatSourceNotFound(unknown: string[], available: string[], ctx: ToolsetCtx): string {
  return `Storybook source not found: ${unknown.map((id) => `"${id}"`).join(', ')}. Available sources: ${available.join(', ')}. Use the ${getToolName(ctx)(DOCS_METHOD_REFS.list)} tool to see available sources.`;
}

function formatNextPage(
  nextCursor: string,
  options: { narrowable: boolean },
  ctx: ToolsetCtx
): string {
  return [
    `More entries follow. Next page: ${formatCall(DOCS_METHOD_REFS.list, { cursor: nextCursor }, ctx)}`,
    ...(options.narrowable
      ? [
          `To list only some sources: ${formatCall(DOCS_METHOD_REFS.list, { storybookIds: ['<id>'] }, ctx)}`,
        ]
      : []),
  ].join('\n');
}

function renderListRefusal(refusal: DocsListRefusal, ctx: ToolsetCtx): string {
  const startAgain = (query: ListQuery) =>
    `Start again without a cursor: ${formatCall(DOCS_METHOD_REFS.list, query, ctx)}`;
  switch (refusal.kind) {
    case 'unknown-sources':
      return formatSourceNotFound(refusal.unknown, refusal.available, ctx);
    case 'cursor-unreadable':
      return `This cursor was not issued by ${getToolName(ctx)(DOCS_METHOD_REFS.list)}. ${startAgain({ withStoryIds: false })}`;
    case 'cursor-conflict':
      return 'This cursor continues a listing with other inputs. Pass the cursor on its own, or leave it out to start a new listing.';
    case 'cursor-stale':
      return `The listing changed since this cursor was issued. ${startAgain(refusal.query)}`;
    default: {
      const exhaustive: never = refusal;
      return exhaustive;
    }
  }
}

function refuseList(
  refusal: DocsListRefusal,
  ctx: ToolsetCtx
): ToolsetOutcome<DocsListOutput, DocsListFailure> {
  return { ok: false, data: { refusal }, markdown: renderListRefusal(refusal, ctx) };
}

async function readSingleListing(
  access: DocsAccess,
  query: ListQuery
): Promise<Listing<{ manifests: AllManifests }>> {
  return {
    sections: [{ manifests: await access.list(query) }],
    keyOf: () => undefined,
    format: ([only]) => formatManifestsToLists(only.manifests, query),
    toData: ([only]) => ({ manifests: only.manifests }),
  };
}

async function readComposedListing(
  sources: DocsSource[],
  query: ListQuery
): Promise<Listing<SourceListing>> {
  const listings = await listSources(sources, query);
  let index: string | undefined;
  return {
    sections: listings,
    keyOf: (listing) => listing.source.id,
    format: (sections) => formatMultiSourceManifestsToLists(sections, query),
    index: () => (index ??= formatSourceIndex(listings)),
    toData: (sections) => ({ sources: sections }),
  };
}

function selectSources(
  sources: DocsSource[],
  storybookIds: string[] | undefined
): { sources: DocsSource[] } | { unknown: string[] } {
  if (!storybookIds) {
    return { sources };
  }
  const unknown = storybookIds.filter((id) => !sources.some(({ source }) => source.id === id));
  return unknown.length > 0
    ? { unknown }
    : { sources: sources.filter(({ source }) => storybookIds.includes(source.id)) };
}

function listOutcome<TSection extends ListSection>(
  listing: Listing<TSection>,
  request: ListRequest,
  ctx: ToolsetCtx
): ToolsetOutcome<DocsListOutput, DocsListFailure> {
  const { query } = request;
  const first = request.resume === undefined;
  const paged = pageListing(listing.sections, {
    request,
    keyOf: listing.keyOf,
    tokenBudget: LIST_PAGE_TOKEN_BUDGET,
    render: (page) =>
      [
        first && page.nextCursor ? listing.index?.() : undefined,
        listing.format(page.sections),
        page.nextCursor
          ? formatNextPage(page.nextCursor, { narrowable: listing.index !== undefined }, ctx)
          : undefined,
      ]
        .filter((block) => block !== undefined)
        .join('\n\n'),
  });
  if (!paged.ok) {
    return refuseList({ kind: paged.refusal, query }, ctx);
  }

  const { page, markdown, tokenCount } = paged;
  const data: DocsListOutput = {
    withStoryIds: query.withStoryIds,
    ...listing.toData(page.sections),
    ...(query.storybookIds ? { storybookIds: query.storybookIds } : {}),
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
  };

  // A listing of nothing but errors is not a usage signal, so nothing is counted then.
  const counted = selectReportedManifests(data);
  return {
    ok: true,
    data,
    markdown,
    ...(counted
      ? {
          telemetry: {
            payload: {
              componentCount: Object.keys(counted.componentManifest.components).length,
              docsCount: Object.keys(counted.docsManifest?.docs ?? {}).length,
              resultTokenCount: tokenCount,
              sourceCount: data.sources?.length,
              paged: !first || page.nextCursor !== undefined,
              filtered: query.storybookIds !== undefined,
            },
          },
        }
      : {}),
  };
}

/** Not-found message for an unknown component or docs id. */
function formatEntryNotFound(
  { id, storybookId, suggestions = [], unreadableSources = [] }: DocsShowOutput,
  ctx: ToolsetCtx
): string {
  const suffix = storybookId ? ` in source "${storybookId}"` : '';
  const notFound = `Component or Docs Entry not found: "${id}"${suffix}.`;
  const listHint = `Use the ${getToolName(ctx)(DOCS_METHOD_REFS.list)} tool to see available components and documentation entries.`;
  if (suggestions.length === 0 && unreadableSources.length === 0) {
    return `${notFound} ${listHint}`;
  }
  return [
    notFound,
    ...(suggestions.length > 0
      ? [
          '',
          'Closest matches:',
          ...suggestions.map(
            (suggestion) => `- ${suggestion.name}: ${formatShowCall(suggestion, ctx)}`
          ),
        ]
      : []),
    ...(unreadableSources.length > 0
      ? [
          '',
          'Sources that could not be read:',
          ...unreadableSources.map((source) => `- ${source.storybookId}: ${source.error}`),
        ]
      : []),
    '',
    listHint,
  ].join('\n');
}

function formatResolvedElsewhere(
  id: string,
  { storybookId, resolvedStorybookId }: DocsShowOutput | DocsShowStoryOutput,
  ctx: ToolsetCtx
): string {
  const scope =
    ctx.transport === 'cli'
      ? `--storybookId ${resolvedStorybookId}`
      : `storybookId "${resolvedStorybookId}"`;
  return `> "${id}" is not in source "${storybookId}"; showing it from source "${resolvedStorybookId}". Pass ${scope} on follow-up calls for this source.`;
}

/** Pure renderer for `show`; the handler attaches it to both outcome branches. */
function renderShow(data: DocsShowOutput, ctx: ToolsetCtx): string {
  const resolution = resolveShow(data);
  switch (resolution.kind) {
    case 'source-error':
    case 'notice':
      return resolution.message;
    case 'entry-missing':
      return formatEntryNotFound(data, ctx);
    case 'found': {
      const documentation =
        resolution.entry.kind === 'doc'
          ? formatDocsManifest(resolution.entry.doc)
          : formatComponentManifest(
              resolution.entry.component,
              getToolName(ctx)(DOCS_METHOD_REFS.showStory)
            );
      return data.resolvedStorybookId
        ? `${formatResolvedElsewhere(data.id, data, ctx)}\n\n${documentation}`
        : documentation;
    }
    default: {
      const exhaustive: never = resolution;
      return exhaustive;
    }
  }
}

/** The stories a miss can be corrected to, with ids where the manifest carries them. */
function formatAvailableStories(stories: ComponentEntry['component']['stories']): string {
  const listed = stories
    ?.map((story) => (story.id ? `${story.name} (${story.id})` : story.name))
    .join(', ');
  return listed || 'none';
}

/** Pure renderer for `showStory`. */
function renderShowStory(
  resolution: ShowStoryResolution,
  data: DocsShowStoryOutput,
  ctx: ToolsetCtx
): string {
  switch (resolution.kind) {
    case 'input-invalid':
      return `Provide either \`storyId\`, or both \`componentId\` and \`storyName\`. Story ids are listed by the ${getToolName(ctx)(DOCS_METHOD_REFS.list)} tool with \`withStoryIds: true\` and in ${getToolName(ctx)(DOCS_METHOD_REFS.show)} output.`;
    case 'source-error':
    case 'notice':
      return resolution.message;
    case 'component-missing':
      return data.storyId !== undefined
        ? `Story not found: "${data.storyId}". Use the ${getToolName(ctx)(DOCS_METHOD_REFS.list)} tool with \`withStoryIds: true\` to see available stories and their ids.`
        : `Component not found: "${data.componentId}". Use the ${getToolName(ctx)(DOCS_METHOD_REFS.list)} tool to see available components.`;
    case 'story-missing': {
      const availableStories = formatAvailableStories(resolution.component.stories);
      return data.storyId !== undefined
        ? `Story not found: "${data.storyId}" for component "${resolution.component.id}". Available stories: ${availableStories}`
        : `Story "${data.storyName}" not found for component "${data.componentId}". Available stories: ${availableStories}`;
    }
    case 'found': {
      const documentation = formatStoryDocumentation(resolution.component, resolution.story.name);
      return data.resolvedStorybookId
        ? `${formatResolvedElsewhere(resolution.component.id, data, ctx)}\n\n${documentation}`
        : documentation;
    }
    default: {
      const exhaustive: never = resolution;
      return exhaustive;
    }
  }
}

function storybookIdField(defaultSourceId: string | undefined) {
  const description =
    defaultSourceId === undefined
      ? 'The ID of the Storybook source to query (e.g., "design-system"), as listed by the docs list tool. This composition has no Storybook of its own, so there is no default.'
      : `The ID of the Storybook source to query (e.g., "${defaultSourceId}", "design-system"). Defaults to "${defaultSourceId}", this Storybook.`;
  return {
    storybookId: v.optional(v.pipe(v.string(), v.description(description)), defaultSourceId),
  };
}

type SourceAccess = { storybookId?: string; access: DocsAccess };

// The entries a source lists, or, in one line, why it could not be read.
async function readEntries({
  storybookId,
  access,
}: SourceAccess): Promise<{ storybookId?: string; entries: DocsListedEntry[]; error?: string }> {
  try {
    const names = await listEntryNames(access);
    return { storybookId, entries: names.map((name) => ({ ...name, storybookId })) };
  } catch (error) {
    const reason =
      error instanceof RequiresOwnMcpError
        ? `private, read it through its own MCP endpoint: ${error.endpoint}`
        : (error instanceof Error ? error.message : String(error)).split('\n')[0];
    return { storybookId, entries: [], error: reason };
  }
}

// A source that needs its own MCP is an answer to route the agent, not a failed lookup.
async function resolveFromSource(
  access: DocsAccess,
  id: string
): Promise<Pick<DocsShowOutput, 'entry' | 'notice'>> {
  try {
    return { entry: await access.resolve(id) };
  } catch (error) {
    if (error instanceof RequiresOwnMcpError) {
      return { notice: error.message };
    }
    throw error;
  }
}

/**
 * Picks the access for a lookup, or explains which source the caller should have named.
 *
 * In a composition the id alone is ambiguous, so an unknown `storybookId` is a result the agent can
 * act on — the available ids and where to find them — rather than a thrown error.
 */
function selectSource(
  sources: DocsSource[] | undefined,
  storybookId: string | undefined,
  ctx: ToolsetCtx
): { access?: DocsAccess; sourceError?: string } {
  if (!sources?.length) {
    return {};
  }

  const available = sources.map(({ source }) => source.id);

  if (storybookId === undefined) {
    return {
      sourceError: `No storybookId was given, and this composition has no Storybook of its own to default to. Available sources: ${available.join(', ')}. Use the ${getToolName(ctx)(DOCS_METHOD_REFS.list)} tool to see available sources.`,
    };
  }

  const match = sources.find(({ source }) => source.id === storybookId);
  if (!match) {
    return { sourceError: formatSourceNotFound([storybookId], available, ctx) };
  }

  return { access: match.access };
}

/**
 * Creates the public docs API over an injected {@link DocsAccess}.
 *
 * The toolset never reads services or manifests itself, so the same definition serves the dev
 * server (open services or the built manifests), a hosted Storybook (manifest files over any
 * provider), and a composition of several of those.
 */
export function createDocsToolset(options: CreateDocsToolsetOptions) {
  const { docsAccess, sources } = options;
  const multiSource = !!sources?.length;

  // The options union cannot exclude an empty array, and every handler would otherwise fail later
  // with a bare TypeError on a missing access.
  if (!multiSource && !docsAccess) {
    throw new Error('createDocsToolset requires a docsAccess or at least one source.');
  }

  // A composition lets the caller name the Storybook, defaulting to the one without a url when
  // there is one; a single one must not ask.
  const defaultSourceId = sources?.find(({ source }) => !source.url)?.source.id;
  const showSchema = multiSource
    ? v.strictObject({
        id: v.pipe(v.string(), v.description('The component or docs entry ID (e.g., "button")')),
        ...storybookIdField(defaultSourceId),
      })
    : v.strictObject({
        id: v.pipe(v.string(), v.description('The component or docs entry ID (e.g., "button")')),
      });

  // Two selector shapes in one flat object: MCP requires an `inputSchema` whose root is
  // `type: "object"`, so this cannot be a top-level union (it would convert to a bare `anyOf`),
  // and valibot refinements don't survive JSON Schema conversion, so the either-shape rule is
  // enforced by the handler, which renders actionable guidance instead of a validation error.
  const showStoryFields = {
    storyId: v.pipe(
      v.optional(v.string()),
      v.description(
        'The story ID, as listed by the docs list tool with withStoryIds: true and shown next to each story in the component documentation (e.g., "button--primary"). Prefer this over componentId + storyName whenever you have a story ID.'
      )
    ),
    componentId: v.pipe(
      v.optional(v.string()),
      v.description(
        'The component ID (e.g., "button"). Use together with storyName, and only when you have no story ID.'
      )
    ),
    storyName: v.pipe(
      v.optional(v.string()),
      v.description(
        'The human-readable story name (e.g., "Primary"). Use together with componentId.'
      )
    ),
  };
  const showStorySchema = multiSource
    ? v.strictObject({ ...showStoryFields, ...storybookIdField(defaultSourceId) })
    : v.strictObject(showStoryFields);

  const listFields = {
    withStoryIds: v.optional(
      v.pipe(
        v.boolean(),
        v.description(
          'When true, includes story sub-bullets under each component with story name and story ID. This makes the list much longer: leave it off to look up components, and use it only to discover story IDs for downstream story-focused workflows without filesystem lookup.'
        )
      ),
      false
    ),
  };
  const cursorField = {
    cursor: v.optional(
      v.pipe(
        v.string(),
        v.description(
          "Continues a listing that did not fit in one result. Take it from the next-page call at the end of that result and pass it on its own: it already carries that listing's other inputs."
        )
      )
    ),
  };
  const listSchema = multiSource
    ? v.strictObject({
        ...listFields,
        storybookIds: v.optional(
          v.pipe(
            v.array(v.string()),
            v.minLength(1),
            v.description(
              'List only these Storybook sources, by ID (e.g., ["design-system"]). Leave it out to list every source.'
            )
          )
        ),
        ...cursorField,
      })
    : v.strictObject({ ...listFields, ...cursorField });

  /** The access for a lookup, plus the id it was scoped to. */
  const access = (storybookId: string | undefined, ctx: ToolsetCtx) =>
    multiSource ? selectSource(sources, storybookId, ctx) : { access: docsAccess };

  const sourceAccesses: SourceAccess[] = multiSource
    ? sources!.map(({ source, access: sourceAccess }) => ({
        storybookId: source.id,
        access: sourceAccess,
      }))
    : [{ access: docsAccess! }];

  // The entry from the one other source that has the id, since agents often leave out or mix up
  // storybookId.
  const resolveInOtherSource = async (
    id: string,
    requestedStorybookId: string | undefined
  ): Promise<Pick<DocsShowOutput, 'entry' | 'resolvedStorybookId'> | undefined> => {
    const others = sourceAccesses.filter((source) => source.storybookId !== requestedStorybookId);
    const lookups = await Promise.all(
      others.map(async (source) => ({
        source,
        entry: await source.access.resolve(id).catch(() => undefined),
      }))
    );

    const hits = lookups.filter(({ entry }) => entry !== undefined);
    if (hits.length !== 1) {
      return undefined;
    }
    const [{ source, entry }] = hits;
    return { entry, resolvedStorybookId: source.storybookId };
  };

  // An id the requested source does not have is shown from the one other source that has it.
  // Otherwise the closest listed entries are suggested, and every source that could not be read is
  // named.
  const recoverMissedId = async (
    id: string,
    requestedStorybookId: string | undefined
  ): Promise<Partial<DocsShowOutput>> => {
    const elsewhere = await resolveInOtherSource(id, requestedStorybookId);
    if (elsewhere) {
      return elsewhere;
    }

    const listings = await Promise.all(sourceAccesses.map(readEntries));
    // A source can list an id it fails to resolve; suggesting it would repeat the failed call.
    const suggestions = suggestEntries(
      id,
      listings
        .flatMap(({ entries }) => entries)
        .filter((entry) => entry.id !== id || entry.storybookId !== requestedStorybookId)
    );
    const unreadableSources = listings.flatMap(({ storybookId, error }) =>
      storybookId !== undefined && error !== undefined ? [{ storybookId, error }] : []
    );
    return {
      ...(suggestions.length > 0 ? { suggestions } : {}),
      ...(unreadableSources.length > 0 ? { unreadableSources } : {}),
    };
  };

  return defineToolset({
    id: DOCS_TOOLSET_ID,
    description: 'Storybook component and docs documentation.',
    methods: {
      [DOCS_METHOD_NAMES.list]: {
        input: listSchema,
        title: 'List All Documentation',
        description: describeList,
        handler: async (input, ctx): Promise<ToolsetOutcome<DocsListOutput, DocsListFailure>> => {
          const parsed = readListRequest(input);
          if (!parsed.ok) {
            return refuseList({ kind: parsed.refusal }, ctx);
          }
          const { request } = parsed;

          if (!multiSource) {
            return listOutcome(await readSingleListing(docsAccess!, request.query), request, ctx);
          }

          const selected = selectSources(sources!, request.query.storybookIds);
          if ('unknown' in selected) {
            return refuseList(
              request.resume
                ? { kind: 'cursor-stale', query: request.query }
                : {
                    kind: 'unknown-sources',
                    unknown: selected.unknown,
                    available: sources!.map(({ source }) => source.id),
                  },
              ctx
            );
          }
          const resumeAt = request.resume
            ? selected.sources.findIndex(({ source }) => source.id === request.resume!.source)
            : 0;
          if (resumeAt === -1) {
            return refuseList({ kind: 'cursor-stale', query: request.query }, ctx);
          }
          return listOutcome(
            await readComposedListing(selected.sources.slice(resumeAt), request.query),
            request,
            ctx
          );
        },
      },
      [DOCS_METHOD_NAMES.show]: {
        input: showSchema,
        title: 'Get Documentation',
        description: describeShow,
        handler: async (input, ctx): Promise<ToolsetOutcome<DocsShowOutput>> => {
          const { id, storybookId } = input as { id: string; storybookId?: string };
          const selected = access(storybookId, ctx);
          let data: DocsShowOutput = selected.sourceError
            ? { id, storybookId, sourceError: selected.sourceError }
            : { id, storybookId, ...(await resolveFromSource(selected.access!, id)) };
          if (resolveShow(data).kind === 'entry-missing') {
            data = { ...data, ...(await recoverMissedId(id, storybookId)) };
          }

          const markdown = renderShow(data, ctx);

          const telemetry = {
            payload: {
              componentId: id,
              found: data.entry !== undefined,
              resolvedElsewhere: data.resolvedStorybookId !== undefined,
              suggestionCount: data.suggestions?.length ?? 0,
              resultTokenCount: estimateTokens(markdown),
            },
          };
          return isDocsShowError(data)
            ? { ok: false, data, markdown, telemetry }
            : { ok: true, data, markdown, telemetry };
        },
      },
      [DOCS_METHOD_NAMES.showStory]: {
        input: showStorySchema,
        title: 'Get Documentation for Story',
        description:
          'Get detailed documentation for a specific story variant of a UI component. Use this when you need to see more usage examples of a component, via the stories written for it. Identify the story by its story ID (preferred), or by componentId plus storyName.',
        handler: async (input, ctx): Promise<ToolsetOutcome<DocsShowStoryOutput>> => {
          const { storyId, componentId, storyName, storybookId } = input as {
            storyId?: string;
            componentId?: string;
            storyName?: string;
            storybookId?: string;
          };
          const request: DocsShowStoryOutput = { storyId, componentId, storyName, storybookId };

          // The id shape wins when both are passed, mirroring its listed preference.
          const resolveId =
            storyId !== undefined
              ? componentIdOfStoryId(storyId)
              : componentId !== undefined && storyName !== undefined
                ? componentId
                : undefined;

          const selected = resolveId !== undefined ? access(storybookId, ctx) : {};
          let data: DocsShowStoryOutput =
            selected.access && resolveId !== undefined
              ? { ...request, ...(await resolveFromSource(selected.access, resolveId)) }
              : { ...request, sourceError: selected.sourceError };
          if (
            multiSource &&
            resolveId !== undefined &&
            resolveShowStory(data).kind === 'component-missing'
          ) {
            data = { ...data, ...(await resolveInOtherSource(resolveId, storybookId)) };
          }

          const resolution = resolveShowStory(data);
          const markdown = renderShowStory(resolution, data, ctx);

          const telemetry = {
            payload: {
              found: resolution.kind === 'found',
              storyId: resolution.kind === 'found' ? resolution.story.id : storyId,
              lookup: storyId !== undefined ? 'storyId' : 'name',
              resolvedElsewhere: data.resolvedStorybookId !== undefined,
              resultTokenCount: estimateTokens(markdown),
            },
          };
          return isDocsShowStoryError(data)
            ? { ok: false, data, markdown, telemetry }
            : { ok: true, data, markdown, telemetry };
        },
      },
    },
  });
}

export type DocsToolset = ReturnType<typeof createDocsToolset>;
