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
  internal: true, // this service really only ensures that the MDX docs are available in manifests, so there is no need to expose it to the public API
  initialState: { components: {} } as MdxServiceState,
  queries: {
    mdxForComponent: {
      input: mdxInputSchema,
      output: mdxOutputSchema,
      handler: (input, ctx) => ctx.self.state.components[input.id],
      load: async (input, ctx) => {
        await ctx.self.commands._extractMdxForComponent(input);
      },
      staticPath: (input) => mdxQueryStaticPath(input.id),
    },
    mdxForAllComponents: {
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
      internal: true,
      input: mdxInputSchema,
      output: mdxOutputSchema,
    },
    _extractAllMdx: {
      internal: true,
      input: v.undefined(),
      output: v.void(),
    },
  },
});
