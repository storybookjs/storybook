import * as v from 'valibot';

import {
  defineToolset,
  reportToolsetTelemetry,
  type ToolsetCtx,
  type ToolsetOutcome,
} from '../../toolset-definition.ts';
import { getToolName, type ToolsetMethodId } from '../../toolset-names.ts';
import type { DocsAccess, ResolvedDocsEntry } from './access.ts';
import {
  formatComponentManifest,
  formatDocsManifest,
  formatManifestsToLists,
  formatMultiSourceManifestsToLists,
  formatStoryDocumentation,
  MAX_STORIES_TO_SHOW,
} from './manifest-formatter/markdown.ts';
import type { AllManifests } from './manifest-formatter/manifest-types.ts';
import { listSources, type DocsSource } from './multi-source.ts';
import type { SourceListing } from './sources.ts';
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

export type DocsListOutput = {
  withStoryIds: boolean;
  /** Single-source listing. */
  manifests?: AllManifests;
  /** Per-source listings, in composition. */
  sources?: SourceListing[];
};

export type DocsShowOutput = {
  id: string;
  entry?: ResolvedDocsEntry;
  storybookId?: string;
  /** Set when the request named no source, or one that does not exist. */
  sourceError?: string;
};

export type DocsShowStoryOutput = {
  componentId?: string;
  storyName?: string;
  storyId?: string;
  entry?: ResolvedDocsEntry;
  storybookId?: string;
  sourceError?: string;
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
  | { kind: 'entry-missing' }
  | { kind: 'found'; entry: ResolvedDocsEntry };

function resolveShow({ entry, sourceError }: DocsShowOutput): ShowResolution {
  if (sourceError !== undefined) {
    return { kind: 'source-error', message: sourceError };
  }
  if (entry === undefined) {
    return { kind: 'entry-missing' };
  }
  return { kind: 'found', entry };
}

type ComponentEntry = Extract<ResolvedDocsEntry, { kind: 'component' }>;

/** The `showStory` counterpart of {@link ShowResolution}. */
type ShowStoryResolution =
  | { kind: 'input-invalid' }
  | { kind: 'source-error'; message: string }
  | { kind: 'component-missing' }
  | { kind: 'story-missing'; component: ComponentEntry['component'] }
  | { kind: 'found'; component: ComponentEntry['component']; storyName: string };

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
  const { entry, storyId, storyName, sourceError } = data;
  if (!isShowStorySelector(data)) {
    return { kind: 'input-invalid' };
  }
  if (sourceError !== undefined) {
    return { kind: 'source-error', message: sourceError };
  }
  if (entry === undefined || entry.kind !== 'component') {
    return { kind: 'component-missing' };
  }
  const { component } = entry;
  const story =
    storyId !== undefined
      ? component.stories?.find((candidate) => candidate.id === storyId)
      : component.stories?.find((candidate) => candidate.name === storyName);
  return story
    ? { kind: 'found', component, storyName: story.name }
    : { kind: 'story-missing', component };
}

/**
 * Whether `docs.show` failed: an unusable source, or an id that resolved to nothing.
 *
 * The handlers encode this in the outcome tag; the predicate stays exported because it is part of
 * the frozen `@storybook/mcp` API.
 */
export function isDocsShowError(output: DocsShowOutput): boolean {
  return resolveShow(output).kind !== 'found';
}

/** Whether `docs.showStory` failed: an unusable source, a missing component, or a missing story. */
export function isDocsShowStoryError(output: DocsShowStoryOutput): boolean {
  return resolveShowStory(output).kind !== 'found';
}

function describeList(ctx: ToolsetCtx): string {
  return `List all available UI components and documentation entries from the Storybook, returning the IDs the other documentation tools take as input. Call this first for any UI task — before writing a new component, check what the design system already provides and build on it instead of hand-rolling a duplicate; before answering any question about props, API, or usage, discover the relevant IDs here rather than reading component source. Then fetch the entries with ${getToolName(ctx)(DOCS_METHOD_REFS.show)}, referencing only IDs returned here — never guess IDs. When multiple Storybook sources are configured, entries from every source are included; scope follow-up calls to one source via their \`storybookId\` input. Pass \`withStoryIds: true\` when you need story IDs for other tools.`;
}

function describeShow(ctx: ToolsetCtx): string {
  return `Get documentation for a UI component or docs entry.

Returns the first ${MAX_STORIES_TO_SHOW} stories (including story IDs) with code snippets showing how props are used, plus TypeScript prop definitions. Call this before using a component to avoid hallucinating prop names, types, or valid combinations, and to answer any question about a component's props, API, or usage — reading or grepping the component source is not a substitute. Stories reveal real prop usage patterns, interactions, and edge cases that type definitions alone don't show. If the example stories don't show the prop you need, use the ${getToolName(ctx)(DOCS_METHOD_REFS.showStory)} tool to fetch the story documentation for the specific story variant you need — its story ID can be passed directly as \`storyId\`.

Example: id="button" returns Primary, Secondary, Large stories with code like <Button variant="primary" size="large"> showing actual prop combinations.`;
}

/** Not-found message for an unknown component or docs id. */
function formatEntryNotFound(id: string, storybookId: string | undefined, ctx: ToolsetCtx): string {
  const suffix = storybookId ? ` in source "${storybookId}"` : '';
  return `Component or Docs Entry not found: "${id}"${suffix}. Use the ${getToolName(ctx)(DOCS_METHOD_REFS.list)} tool to see available components and documentation entries.`;
}

/** Pure renderer for `show`; the handler attaches it to both outcome branches. */
function renderShow(data: DocsShowOutput, ctx: ToolsetCtx): string {
  const resolution = resolveShow(data);
  switch (resolution.kind) {
    case 'source-error':
      return resolution.message;
    case 'entry-missing':
      return formatEntryNotFound(data.id, data.storybookId, ctx);
    case 'found':
      return resolution.entry.kind === 'doc'
        ? formatDocsManifest(resolution.entry.doc)
        : formatComponentManifest(resolution.entry.component);
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
function renderShowStory(data: DocsShowStoryOutput, ctx: ToolsetCtx): string {
  const resolution = resolveShowStory(data);
  switch (resolution.kind) {
    case 'input-invalid':
      return `Provide either \`storyId\`, or both \`componentId\` and \`storyName\`. Story ids are listed by the ${getToolName(ctx)(DOCS_METHOD_REFS.list)} tool with \`withStoryIds: true\` and in ${getToolName(ctx)(DOCS_METHOD_REFS.show)} output.`;
    case 'source-error':
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
    case 'found':
      return formatStoryDocumentation(resolution.component, resolution.storyName);
    default: {
      const exhaustive: never = resolution;
      return exhaustive;
    }
  }
}

const storybookIdField = {
  storybookId: v.pipe(
    v.string(),
    v.description('The ID of the Storybook source to query (e.g., "local", "design-system")')
  ),
};

/**
 * Picks the access for a lookup, or explains which source the caller should have named.
 *
 * In a composition the id alone is ambiguous, so a missing or unknown `storybookId` is a result the
 * agent can act on — the available ids and where to find them — rather than a thrown error.
 */
function selectSource(
  sources: DocsSource[] | undefined,
  storybookId: string | undefined,
  ctx: ToolsetCtx
): { access?: DocsAccess; sourceError?: string } {
  if (!sources?.length) {
    return {};
  }

  const available = sources.map(({ source }) => source.id).join(', ');
  const listRef = `Use the ${getToolName(ctx)(DOCS_METHOD_REFS.list)} tool to see available sources.`;

  if (!storybookId) {
    return { sourceError: `storybookId is required. Available sources: ${available}. ${listRef}` };
  }

  const match = sources.find(({ source }) => source.id === storybookId);
  if (!match) {
    return {
      sourceError: `Storybook source not found: "${storybookId}". Available sources: ${available}. ${listRef}`,
    };
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

  // A composition needs the caller to say which Storybook they mean; a single one must not ask.
  const showSchema = multiSource
    ? v.object({
        id: v.pipe(v.string(), v.description('The component or docs entry ID (e.g., "button")')),
        ...storybookIdField,
      })
    : v.object({
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
    ? v.object({ ...showStoryFields, ...storybookIdField })
    : v.object(showStoryFields);

  /** The access for a lookup, plus the id it was scoped to. */
  const access = (storybookId: string | undefined, ctx: ToolsetCtx) =>
    multiSource ? selectSource(sources, storybookId, ctx) : { access: docsAccess };

  return defineToolset({
    id: DOCS_TOOLSET_ID,
    description: 'Storybook component and docs documentation.',
    methods: {
      [DOCS_METHOD_NAMES.list]: {
        input: v.object({
          withStoryIds: v.optional(
            v.pipe(
              v.boolean(),
              v.description(
                'When true, includes story sub-bullets under each component with story name and story ID. Use this to discover IDs for downstream story-focused workflows without filesystem lookup.'
              )
            ),
            false
          ),
        }),
        title: 'List All Documentation',
        description: describeList,
        handler: async (input, ctx): Promise<ToolsetOutcome<DocsListOutput, never>> => {
          const { withStoryIds } = input;
          const data: DocsListOutput = multiSource
            ? { withStoryIds, sources: await listSources(sources!, { withStoryIds }) }
            : { withStoryIds, manifests: await docsAccess!.list({ withStoryIds }) };

          const markdown = data.sources
            ? formatMultiSourceManifestsToLists(data.sources, { withStoryIds })
            : formatManifestsToLists(data.manifests!, { withStoryIds });

          // A listing of nothing but errors is not a usage signal, so nothing is counted then.
          const counted = selectReportedManifests(data);
          if (counted) {
            await reportToolsetTelemetry(ctx, 'tool:listAllDocumentation', {
              toolset: 'docs',
              componentCount: Object.keys(counted.componentManifest.components).length,
              docsCount: Object.keys(counted.docsManifest?.docs ?? {}).length,
              resultTokenCount: estimateTokens(markdown),
              sourceCount: data.sources?.length,
            });
          }

          return { ok: true, data, markdown };
        },
      },
      [DOCS_METHOD_NAMES.show]: {
        input: showSchema,
        title: 'Get Documentation',
        description: describeShow,
        handler: async (input, ctx): Promise<ToolsetOutcome<DocsShowOutput>> => {
          const { id, storybookId } = input as { id: string; storybookId?: string };
          const selected = access(storybookId, ctx);
          const data: DocsShowOutput = selected.sourceError
            ? { id, storybookId, sourceError: selected.sourceError }
            : { id, storybookId, entry: await selected.access!.resolve(id) };

          const markdown = renderShow(data, ctx);

          await reportToolsetTelemetry(ctx, 'tool:getDocumentation', {
            toolset: 'docs',
            componentId: id,
            found: data.entry !== undefined,
            resultTokenCount: estimateTokens(markdown),
          });

          return isDocsShowError(data)
            ? { ok: false, data, markdown }
            : { ok: true, data, markdown };
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
          const data: DocsShowStoryOutput =
            selected.access && resolveId !== undefined
              ? { ...request, entry: await selected.access.resolve(resolveId) }
              : { ...request, sourceError: selected.sourceError };

          const markdown = renderShowStory(data, ctx);

          return isDocsShowStoryError(data)
            ? { ok: false, data, markdown }
            : { ok: true, data, markdown };
        },
      },
    },
  });
}

export type DocsToolset = ReturnType<typeof createDocsToolset>;
