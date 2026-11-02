import * as v from 'valibot';

import { defineService, type ServiceInstanceOf } from 'storybook/open-service';

export const MDX_SOURCE_SERVICE_ID = 'experimental-manager-docs/mdx-source' as const;

const importPathSchema = v.object({ importPath: v.string() });

export const mdxSourceErrorSchema = v.object({
  file: v.string(),
  line: v.number(),
  column: v.number(),
  construct: v.string(),
  message: v.string(),
});

export const mdxSourceRecordSchema = v.object({
  source: v.string(),
  revision: v.number(),
  error: v.optional(mdxSourceErrorSchema),
});

export const mdxSourceChangeSchema = v.union([
  v.object({
    importPath: v.string(),
    revision: v.number(),
    source: v.string(),
  }),
  v.object({
    importPath: v.string(),
    revision: v.number(),
    error: mdxSourceErrorSchema,
  }),
]);

export type MdxSourceRecord = v.InferOutput<typeof mdxSourceRecordSchema>;

export type MdxSourceServiceState = {
  sources: Record<string, MdxSourceRecord>;
};

export function mdxSourceQueryStaticPath(importPath: string): string {
  return `${importPath}.json`;
}

export const mdxSourceServiceDef = defineService({
  id: MDX_SOURCE_SERVICE_ID,
  internal: true,
  description: 'Raw MDX file text for manager-docs pages, including live-reload revisions.',
  initialState: { sources: {} } as MdxSourceServiceState,
  queries: {
    mdxSource: {
      description: 'Returns the MDX source for one import path, or undefined when not loaded.',
      input: importPathSchema,
      output: v.optional(mdxSourceRecordSchema),
      handler: (input, ctx) => ctx.self.state.sources[input.importPath],
      load: async (input, ctx) => {
        await ctx.self.commands._readMdxSource(input);
      },
      staticPath: (input) => mdxSourceQueryStaticPath(input.importPath),
    },
  },
  commands: {
    _readMdxSource: {
      internal: true,
      description: 'Reads one MDX file and writes its source into state at revision 0.',
      input: importPathSchema,
      output: mdxSourceRecordSchema,
    },
    _applyMdxChange: {
      internal: true,
      description: 'Writes a watched MDX revision (source or parse error) into state.',
      input: mdxSourceChangeSchema,
      output: mdxSourceRecordSchema,
    },
  },
});

export type MdxSourceService = ServiceInstanceOf<typeof mdxSourceServiceDef>;
