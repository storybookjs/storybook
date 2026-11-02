import { registerService } from 'storybook/internal/common';
import type { StoryIndex } from 'storybook/internal/types';

import { ManagerDocsError } from '../errors.ts';
import type { MdxSourceChange } from '../runtime/source-transport.ts';
import { docsMdxFiles } from '../server/watch-mdx.ts';
import { mdxSourceServiceDef, type MdxSourceRecord, type MdxSourceService } from './definition.ts';

let registered: MdxSourceService | undefined;

export function registerMdxSourceService(options: {
  read: (importPath: string) => Promise<string>;
  getIndex: () => Promise<StoryIndex>;
}) {
  registered = registerService(mdxSourceServiceDef, {
    queries: {
      mdxSource: {
        staticInputs: async () => {
          const index = await options.getIndex();
          return docsMdxFiles(Object.values(index.entries)).map((importPath) => ({ importPath }));
        },
      },
    },
    commands: {
      _readMdxSource: {
        handler: async (input, ctx) => {
          const existing = ctx.self.state.sources[input.importPath];
          if (existing?.source) {
            return existing;
          }
          const source = await options.read(input.importPath);
          const record: MdxSourceRecord = existing
            ? { ...existing, source }
            : { source, revision: 0 };
          ctx.self.setState((state) => {
            state.sources[input.importPath] = record;
          });
          return record;
        },
      },
      _applyMdxChange: {
        handler: async (input, ctx) => {
          const existing = ctx.self.state.sources[input.importPath];
          const record: MdxSourceRecord =
            'error' in input
              ? {
                  source: existing?.source ?? '',
                  revision: input.revision,
                  error: input.error,
                }
              : { source: input.source, revision: input.revision };
          ctx.self.setState((state) => {
            state.sources[input.importPath] = record;
          });
          return record;
        },
      },
    },
  });
  return registered;
}

export function applyMdxSourceChange(change: MdxSourceChange): Promise<MdxSourceRecord> {
  if (!registered) {
    throw new ManagerDocsError('MDX source service is not registered.');
  }
  return registered.commands._applyMdxChange(change);
}
