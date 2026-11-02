import { registerService } from 'storybook/internal/common';

import { mdxSourceServiceDef } from './definition.ts';

export function registerMdxSourceService(options: {
  read: (importPath: string) => Promise<string>;
}) {
  return registerService(mdxSourceServiceDef, {
    commands: {
      _readMdxSource: {
        handler: async (input, ctx) => {
          const source = await options.read(input.importPath);
          ctx.self.setState((state) => {
            state.sources[input.importPath] = source;
          });
          return { source };
        },
      },
    },
  });
}
