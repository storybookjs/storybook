import * as v from 'valibot';

import { defineService, type ServiceInstanceOf } from 'storybook/open-service';

export const MDX_SOURCE_SERVICE_ID = 'experimental-manager-docs/mdx-source' as const;

const importPathSchema = v.object({ importPath: v.string() });
const sourceSchema = v.object({ source: v.string() });

export type MdxSourceServiceState = {
  sources: Record<string, string>;
};

export const mdxSourceServiceDef = defineService({
  id: MDX_SOURCE_SERVICE_ID,
  internal: true,
  description: 'Raw MDX file text for manager-docs pages.',
  initialState: { sources: {} } as MdxSourceServiceState,
  queries: {
    mdxSource: {
      description: 'Returns the MDX source for one import path, or undefined when not loaded.',
      input: importPathSchema,
      output: v.optional(sourceSchema),
      handler: (input, ctx) =>
        Object.hasOwn(ctx.self.state.sources, input.importPath)
          ? { source: ctx.self.state.sources[input.importPath] }
          : undefined,
      load: async (input, ctx) => {
        await ctx.self.commands._readMdxSource(input);
      },
    },
  },
  commands: {
    _readMdxSource: {
      internal: true,
      description: 'Reads one MDX file and writes its source into state.',
      input: importPathSchema,
      output: sourceSchema,
    },
  },
});

export type MdxSourceService = ServiceInstanceOf<typeof mdxSourceServiceDef>;
