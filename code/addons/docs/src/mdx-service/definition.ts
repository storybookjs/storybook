import {
  MDX_SERVICE_ID,
  type MdxPayload,
  mdxQueryStaticPath,
} from 'storybook/internal/core-server';

import * as v from 'valibot';

import { defineService } from 'storybook/open-service';

const mdxInputSchema = v.object({ id: v.string() });

const mdxErrorSchema = v.object({
  name: v.string(),
  message: v.string(),
});

const mdxDocPayloadSchema = v.object({
  id: v.string(),
  name: v.string(),
  path: v.string(),
  title: v.string(),
  content: v.optional(v.string()),
  summary: v.optional(v.string()),
  error: v.optional(mdxErrorSchema),
});

const mdxPayloadSchema = v.object({
  id: v.string(),
  name: v.string(),
  docs: v.record(v.string(), mdxDocPayloadSchema),
});

const mdxOutputSchema = v.optional(mdxPayloadSchema);

export type MdxServiceState = {
  components: Record<string, MdxPayload>;
};

export const mdxServiceDef = defineService({
  id: MDX_SERVICE_ID,
  description: 'MDX docs source content keyed by component id.',
  initialState: { components: {} } as MdxServiceState,
  queries: {
    getMdxForComponent: {
      description:
        'Returns MDX docs for one component id, or undefined when no MDX docs have been loaded.',
      input: mdxInputSchema,
      output: mdxOutputSchema,
      handler: (input, ctx) => ctx.self.state.components[input.id],
      load: async (input, ctx) => {
        await ctx.self.commands._extractMdxForComponent(input);
      },
      staticPath: (input) => mdxQueryStaticPath(input.id),
    },
    getMdxForAllComponents: {
      description: 'Returns MDX docs for every MDX component id in the story index.',
      input: v.void(),
      output: v.record(v.string(), mdxPayloadSchema),
      handler: (_input, ctx) => ctx.self.state.components,
      load: async (_input, ctx) => {
        await ctx.self.commands._extractAllMdx(undefined);
      },
    },
  },
  commands: {
    _extractMdxForComponent: {
      description:
        'Reads MDX docs for one component id, writes the payload into service state, and returns it.',
      internal: true,
      input: mdxInputSchema,
      output: mdxOutputSchema,
    },
    _extractAllMdx: {
      description: 'Extracts MDX docs for every MDX component id in the story index.',
      internal: true,
      input: v.undefined(),
      output: v.void(),
    },
  },
});
