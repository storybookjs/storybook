import { readFile, writeFile } from 'node:fs/promises';

import type * as esbuild from 'esbuild';
import { join } from 'pathe';

// esbuild rewrites every free `require` in bundled sources to its `__require` helper, so the
// helper's `typeof require` check is the only free `require` left in an output.
const REQUIRE_HELPER = /\btypeof require\b/;

/**
 * Returns `code` with a `require` defined when it holds esbuild's `__require` helper, which falls
 * back to `require` for the CommonJS dependencies we bundle, or `undefined` when it needs none.
 */
export function addCjsRequire(code: string, uid: string): string | undefined {
  if (!REQUIRE_HELPER.test(code)) {
    return undefined;
  }
  const header = `import { createRequire as CJS_COMPAT_CREATE_REQUIRE_${uid} } from "node:module";var require = CJS_COMPAT_CREATE_REQUIRE_${uid}(import.meta.url);\n`;
  // A hashbang is only valid on the first line.
  const bodyStart = code.startsWith('#!') ? code.indexOf('\n') + 1 : 0;
  return code.slice(0, bodyStart) + header + code.slice(bodyStart);
}

/**
 * Gives `require` only to the node outputs that use it. Outputs that do not stay free of
 * `import.meta.url`, which some runtimes (Cloudflare Workers) lack.
 */
export function cjsRequirePlugin(uid: string): esbuild.Plugin {
  return {
    name: 'cjs-require',
    setup(build) {
      build.onEnd(async (result) => {
        if (result.errors.length || !result.metafile) {
          return;
        }
        const cwd = build.initialOptions.absWorkingDir ?? process.cwd();
        await Promise.all(
          Object.keys(result.metafile.outputs)
            .filter((file) => file.endsWith('.js'))
            .map(async (file) => {
              const path = join(cwd, file);
              const code = addCjsRequire(await readFile(path, 'utf8'), uid);
              if (code !== undefined) {
                await writeFile(path, code);
              }
            })
        );
      });
    },
  };
}
