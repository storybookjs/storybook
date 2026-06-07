import * as v from 'valibot';

import { defineService } from 'storybook/open-service';
import type { ServiceInstanceOf } from '../../types.ts';
import type { DocgenCustomArgTypes, DocgenPayload, DocgenServiceCustomArgTypes } from './types.ts';
import { docgenQueryStaticPath } from './paths.ts';

const docgenInputSchema = v.object({ id: v.string() });
// TODO: Replace this loose schema with the actual ArgTypes schema. ArgTypes are a static
// Storybook construct, but spelling out the full recursive shape here is deferred for now.
const argTypesSchema = v.record(v.string(), v.unknown());
const setCustomArgTypesInputSchema = v.object({
  storyId: v.string(),
  metaArgTypes: v.optional(argTypesSchema),
  storyArgTypes: v.optional(argTypesSchema),
});

type DocgenServiceState = {
  /** Extracted docgen keyed by component id. Populated by the `extractDocgen` command. */
  components: Record<string, DocgenPayload>;
  /** Custom argTypes pushed by the preview. */
  customArgTypes: DocgenServiceCustomArgTypes;
};

export type DocgenService = ServiceInstanceOf<typeof docgenServiceDef>;

function customArgTypesForComponent(
  stored: DocgenServiceCustomArgTypes,
  componentId: string
): DocgenCustomArgTypes | undefined {
  const component = stored.byComponent[componentId];
  if (!stored.project && !component) {
    return undefined;
  }

  return {
    project: stored.project,
    meta: component?.meta,
    stories: component?.stories,
  };
}

function mergeDocgenQueryResult(
  component: DocgenPayload | undefined,
  storedCustomArgTypes: DocgenServiceCustomArgTypes,
  componentId: string
): DocgenPayload | undefined {
  const customArgTypes = customArgTypesForComponent(storedCustomArgTypes, componentId);

  if (!component && !customArgTypes) {
    return undefined;
  }

  if (!component) {
    return {
      id: componentId,
      name: '',
      path: '',
      jsDocTags: {},
      stories: [],
      customArgTypes,
    };
  }

  return customArgTypes ? { ...component, customArgTypes } : component;
}

const docgenErrorSchema = v.object({
  name: v.string(),
  message: v.string(),
});

const docgenJsDocTagsSchema = v.record(v.string(), v.array(v.string()));

const docgenStorySchema = v.object({
  id: v.string(),
  name: v.string(),
  snippet: v.optional(v.string()),
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  error: v.optional(docgenErrorSchema),
});

/** Shared docgen fields on component and subcomponent docgen entries. */
const docgenEntryBaseFields = {
  name: v.string(),
  path: v.string(),
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  import: v.optional(v.string()),
  jsDocTags: docgenJsDocTagsSchema,
  argTypes: v.optional(argTypesSchema),
  error: v.optional(docgenErrorSchema),
};

/**
 * Subcomponent docgen schema.
 *
 * Uses {@link v.looseObject} so provider-specific docgen engine output (for example
 * `reactComponentMeta`) validates without listing every framework integration field in core.
 */
const docgenSubcomponentSchema = v.looseObject(docgenEntryBaseFields);

/**
 * Top-level component docgen payload schema.
 *
 * Uses {@link v.looseObject} for the same reason as {@link docgenSubcomponentSchema}: the open
 * service owns the portable manifest contract while renderers attach engine-specific keys.
 */
const docgenPayloadSchema = v.looseObject({
  id: v.string(),
  ...docgenEntryBaseFields,
  subcomponents: v.optional(v.record(v.string(), docgenSubcomponentSchema)),
  stories: v.array(docgenStorySchema),
});

const docgenOutputSchema = v.optional(docgenPayloadSchema);

/**
 * Definition for the `core/docgen` open service.
 *
 * The query is a thin synchronous read of `state.components[id]` — it returns undefined when
 * nothing has been extracted yet rather than throwing, matching the open-service convention for
 * sync reads. The real work — story index lookup, provider invocation, error handling — lives in
 * the `extractDocgen` command, whose body is supplied at registration time because it needs to
 * close over the server-only story index and the composed `experimental_docgenProvider` chain.
 * The query's `load` hook calls `extractDocgen`, so `getDocgen.loaded()` is the awaitable form and
 * surfaces extraction errors. `getDocgenForAllComponents` delegates to the `extractAllDocgen`
 * command, whose handler is supplied at registration because it needs the story index.
 */
export const docgenServiceDef = defineService({
  id: 'core/docgen',
  description:
    'Component documentation (name, description, props, JSDoc tags) keyed by component id.',
  initialState: { components: {}, customArgTypes: { byComponent: {} } } as DocgenServiceState,
  queries: {
    getDocgen: {
      description: 'Returns the docgen payload for one component id, or undefined when not loaded.',
      input: docgenInputSchema,
      output: docgenOutputSchema,
      handler: (input, ctx) =>
        mergeDocgenQueryResult(
          ctx.self.state.components[input.id],
          ctx.self.state.customArgTypes,
          input.id
        ),
      load: async (input, ctx) => {
        await ctx.self.commands.extractDocgen(input);
      },
      staticPath: (input) => docgenQueryStaticPath(input.id),
    },
    getDocgenForAllComponents: {
      description: 'Returns docgen payloads for every component in the story index.',
      input: v.void(),
      output: v.record(v.string(), docgenPayloadSchema),
      handler: (_input, ctx) => {
        const componentIds = new Set([
          ...Object.keys(ctx.self.state.components),
          ...Object.keys(ctx.self.state.customArgTypes.byComponent),
        ]);

        return Object.fromEntries(
          [...componentIds].flatMap((id) => {
            const merged = mergeDocgenQueryResult(
              ctx.self.state.components[id],
              ctx.self.state.customArgTypes,
              id
            );

            return merged ? [[id, merged]] : [];
          })
        );
      },
      load: async (_input, ctx) => {
        await ctx.self.commands.extractAllDocgen(undefined);
      },
    },
  },
  commands: {
    extractDocgen: {
      description:
        'Resolves the story entry for a component id, runs the registered provider chain, writes the result into state, and returns it (or undefined when no provider produced docgen).',
      input: docgenInputSchema,
      output: docgenOutputSchema,
      // Handler is supplied at registration time so it can close over the story index and the
      // composed experimental_docgenProvider chain.
    },
    extractAllDocgen: {
      description:
        'Extracts docgen for every component id in the story index by invoking `extractDocgen` for each.',
      input: v.undefined(),
      output: v.void(),
      // Handler is supplied at registration time so it can close over the story index.
    },
    setProjectCustomArgTypes: {
      description: 'Writes preview-level custom argTypes into docgen service state.',
      input: v.object({ argTypes: v.optional(argTypesSchema) }),
      output: v.void(),
      // Handler is supplied by the preview runtime.
    },
    setCustomArgTypes: {
      description:
        'Writes custom argTypes from the preview into docgen state for one story, merging with any existing custom argTypes for the component.',
      input: setCustomArgTypesInputSchema,
      output: v.void(),
      // Handler is supplied by the preview runtime.
    },
  },
});
