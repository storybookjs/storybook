import * as v from 'valibot';

import { defineToolset, type ToolsetCtx, type ToolsetOutcome } from '../../toolset-definition.ts';
import { getRef } from '../../toolset-names.ts';
import type { DocsAccess, ResolvedDocsEntry } from './access.ts';
import type { AllManifests } from './manifest-formatter/manifest-types.ts';
import {
  formatComponentManifest,
  formatDocsManifest,
  formatManifestsToLists,
  formatStoryDocumentation,
  MAX_STORIES_TO_SHOW,
} from './manifest-formatter/markdown.ts';

export type CreateDocsToolsetOptions = {
  /** Reads the one Storybook these tools serve. */
  docsAccess: DocsAccess;
};

export type DocsListOutput = {
  withStoryIds: boolean;
  manifests?: AllManifests;
};

export type DocsShowOutput = {
  id: string;
  entry?: ResolvedDocsEntry;
};

export type DocsShowStoryOutput = {
  componentId: string;
  storyName: string;
  entry?: ResolvedDocsEntry;
};

/**
 * The manifests a listing should be reported against.
 *
 * Nothing is returned when the listing produced none — a listing of nothing is not a usage signal.
 */
export function selectReportedManifests({ manifests }: DocsListOutput): AllManifests | undefined {
  return manifests;
}

/**
 * One classification of a `show` lookup, shared by the failure predicate and the renderer so the
 * outcome tag and the rendered prose cannot disagree.
 */
type ShowResolution = { kind: 'entry-missing' } | { kind: 'found'; entry: ResolvedDocsEntry };

function resolveShow({ entry }: DocsShowOutput): ShowResolution {
  return entry === undefined ? { kind: 'entry-missing' } : { kind: 'found', entry };
}

type ComponentEntry = Extract<ResolvedDocsEntry, { kind: 'component' }>;

/** The `showStory` counterpart of {@link ShowResolution}. */
type ShowStoryResolution =
  | { kind: 'component-missing' }
  | { kind: 'story-missing'; component: ComponentEntry['component'] }
  | { kind: 'found'; component: ComponentEntry['component'] };

function resolveShowStory({ entry, storyName }: DocsShowStoryOutput): ShowStoryResolution {
  if (entry === undefined || entry.kind !== 'component') {
    return { kind: 'component-missing' };
  }
  const { component } = entry;
  return component.stories?.some((story) => story.name === storyName)
    ? { kind: 'found', component }
    : { kind: 'story-missing', component };
}

/**
 * Whether `docs.show` failed: an id that resolved to nothing.
 *
 * The handlers encode this in the outcome tag; the predicate stays exported because it is part of
 * the frozen `@storybook/mcp` API.
 */
export function isDocsShowError(output: DocsShowOutput): boolean {
  return resolveShow(output).kind !== 'found';
}

/** Whether `docs.showStory` failed: a missing component, or a missing story. */
export function isDocsShowStoryError(output: DocsShowStoryOutput): boolean {
  return resolveShowStory(output).kind !== 'found';
}

function describeList(ctx: ToolsetCtx): string {
  const ref = getRef(ctx);
  return `List all available UI components and documentation entries from the Storybook, returning the IDs the other documentation tools take as input. Call this first for any UI task — before writing a new component, check what the design system already provides and build on it instead of hand-rolling a duplicate; before answering any question about props, API, or usage, discover the relevant IDs here rather than reading component source. Then fetch the entries with ${ref('docs.show')}, referencing only IDs returned here — never guess IDs. Pass \`withStoryIds: true\` when you need story IDs for other tools.`;
}

function describeShow(ctx: ToolsetCtx): string {
  return `Get documentation for a UI component or docs entry.

Returns the first ${MAX_STORIES_TO_SHOW} stories (including story IDs) with code snippets showing how props are used, plus TypeScript prop definitions. Call this before using a component to avoid hallucinating prop names, types, or valid combinations, and to answer any question about a component's props, API, or usage — reading or grepping the component source is not a substitute. Stories reveal real prop usage patterns, interactions, and edge cases that type definitions alone don't show. If the example stories don't show the prop you need, use the ${getRef(ctx)('docs.showStory')} tool to fetch the story documentation for the specific story variant you need.

Example: id="button" returns Primary, Secondary, Large stories with code like <Button variant="primary" size="large"> showing actual prop combinations.`;
}

/** Not-found message for an unknown component or docs id. */
function formatEntryNotFound(id: string, ctx: ToolsetCtx): string {
  return ctx.consumer === 'mcp'
    ? `Component or Docs Entry not found: "${id}". Use the ${getRef(ctx)('docs.list')} tool to see available components and documentation entries.`
    : `Component or Docs Entry not found: "${id}".`;
}

/** Pure renderer for `show`; the handler attaches it to both outcome branches. */
function renderShow(data: DocsShowOutput, ctx: ToolsetCtx): string {
  const resolution = resolveShow(data);
  switch (resolution.kind) {
    case 'entry-missing':
      return formatEntryNotFound(data.id, ctx);
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

/** Pure renderer for `showStory`. */
function renderShowStory(data: DocsShowStoryOutput, ctx: ToolsetCtx): string {
  const resolution = resolveShowStory(data);
  switch (resolution.kind) {
    case 'component-missing':
      return ctx.consumer === 'mcp'
        ? `Component not found: "${data.componentId}". Use the ${getRef(ctx)('docs.list')} tool to see available components.`
        : `Component not found: "${data.componentId}".`;
    case 'story-missing': {
      const availableStories = resolution.component.stories?.map((story) => story.name).join(', ');
      return `Story "${data.storyName}" not found for component "${data.componentId}". Available stories: ${availableStories || 'none'}`;
    }
    case 'found':
      return formatStoryDocumentation(resolution.component, data.storyName);
    default: {
      const exhaustive: never = resolution;
      return exhaustive;
    }
  }
}

/**
 * Creates the public docs API over an injected {@link DocsAccess}.
 *
 * The toolset never reads services or manifests itself, so the same definition serves the dev
 * server (open services or the built manifests) and a hosted Storybook (manifest files over any
 * provider).
 */
export function createDocsToolset({ docsAccess }: CreateDocsToolsetOptions) {
  return defineToolset({
    id: 'docs',
    description: 'Storybook component and docs documentation.',
    telemetryGroup: 'docs',
    methods: {
      list: {
        schema: v.object({
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
        description: describeList,
        handler: async (input, _ctx): Promise<ToolsetOutcome<DocsListOutput, never>> => {
          const { withStoryIds } = input;
          const manifests = await docsAccess.list({ withStoryIds });

          return {
            ok: true,
            data: { withStoryIds, manifests },
            markdown: formatManifestsToLists(manifests, { withStoryIds }),
          };
        },
      },
      show: {
        schema: v.object({
          id: v.pipe(v.string(), v.description('The component or docs entry ID (e.g., "button")')),
        }),
        description: describeShow,
        handler: async (input, ctx): Promise<ToolsetOutcome<DocsShowOutput>> => {
          const data: DocsShowOutput = {
            id: input.id,
            entry: await docsAccess.resolve(input.id),
          };

          const markdown = renderShow(data, ctx);

          return isDocsShowError(data)
            ? { ok: false, data, markdown }
            : { ok: true, data, markdown };
        },
      },
      showStory: {
        schema: v.object({ componentId: v.string(), storyName: v.string() }),
        description:
          'Get detailed documentation for a specific story variant of a UI component. Use this when you need to see more usage examples of a component, via the stories written for it.',
        handler: async (input, ctx): Promise<ToolsetOutcome<DocsShowStoryOutput>> => {
          const { componentId, storyName } = input;
          const data: DocsShowStoryOutput = {
            componentId,
            storyName,
            entry: await docsAccess.resolve(componentId),
          };

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
