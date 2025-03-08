// eslint-disable-next-line import/no-extraneous-dependencies
import { match } from 'bundle-require';
import type { Plugin } from 'esbuild';

// Must not start with "/" or "./" or "../" or "C:\" or be the exact strings ".." or "."
const NON_NODE_MODULE_RE = /^[A-Z]:[/\\]|^\.{0,2}\/|^\.{1,2}$/;

export const externalPlugin = ({ noExternal }: { noExternal?: (string | RegExp)[] }): Plugin => {
  return {
    name: `external`,

    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        // Respect explicit external/noExternal conditions
        if (match(args.path, noExternal)) {
          return undefined;
        }
      });
    },
  };
};
