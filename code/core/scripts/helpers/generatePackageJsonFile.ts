import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import slash from 'slash';

import { sortPackageJson } from '../../../../scripts/prepare/tools';
import type { getEntries } from '../entries';

const cwd = process.cwd();

export async function generatePackageJsonFile(entries: ReturnType<typeof getEntries>) {
  const location = join(cwd, 'package.json');
  const pkgJson = JSON.parse(await readFile(location, { encoding: 'utf8' }));

  /**
   * Re-create the `exports` field in `code/core/package.json` This way we only need to update the
   * `./scripts/entries.ts` file to ensure all things we create actually exist and are mapped to the
   * correct path.
   */
  pkgJson.exports = entries.reduce<Record<string, Record<string, string>>>((acc, entry) => {
    let main = './' + slash(relative(cwd, entry.file).replace('src', 'dist'));

    const content: Record<string, string> = {};
    if (entry.dts) {
      content.types = main.replace(/\.tsx?/, '.d.ts');
    }
    if (entry.browser) {
      content.import = main.replace(/\.tsx?/, '.js');
    }
    if (entry.node && !entry.browser) {
      content.import = main.replace(/\.tsx?/, '.js');
    }
    if (entry.node) {
      content.require = main.replace(/\.tsx?/, '.cjs');
    }
    if (main === './dist/index.ts' || main === './dist/index.tsx') {
      main = '.';
    }
    /**
     * We always write an entry for /internal/X, even when it's isPublic is true, this is for
     * compatibility reasons. We should remove this once everything stops referencing public APIs as
     * internal.
     *
     * Known references:
     *
     * - VTA
     * - Design addon
     * - Addon kit
     *
     * I expect that we should be able to drop it in the process of of the release of 9.0, or keep
     * it for now, and drop it in the release of 9.1.
     */
    acc[
      main
        .replace(/\/index\.tsx?/, '')
        .replace(/\.tsx?/, '')
        .replace('dist/', 'internal/')
    ] = content;

    if (entry.isPublic) {
      acc[
        main
          .replace(/\/index\.tsx?/, '')
          .replace(/\.tsx?/, '')
          .replace('dist/', '')
      ] = content;
    }
    return acc;
  }, {});

  // Add CLI entry so `sb` can require it.
  pkgJson.exports['./bin/index.cjs'] = './bin/index.cjs';

  // Add the package.json file to the exports, so we can use it to `require.resolve` the package's root easily
  pkgJson.exports['./package.json'] = './package.json';
  pkgJson.exports['./internal/package.json'] = './package.json';

  /**
   * Add the `typesVersion` field to `code/core/package.json`, to make typescript respect and find
   * the correct type annotation files, even when not configured with `"moduleResolution":
   * "Bundler"` If we even decide to only support `"moduleResolution": "Bundler"`, we should be able
   * to remove this part, but that would be a breaking change.
   */
  pkgJson.typesVersions = {
    '*': {
      '*': ['./dist/index.d.ts'],
      ...entries.reduce<Record<string, string[]>>((acc, entry) => {
        if (!entry.dts) {
          return acc;
        }

        let main = slash(relative(cwd, entry.file).replace('src', 'dist'));
        if (main === './dist/index.ts' || main === './dist/index.tsx') {
          main = '.';
        }
        const key = main.replace(/\/index\.tsx?/, '').replace(/\.tsx?/, '');

        if (key === 'dist') {
          return acc;
        }

        const content = ['./' + main.replace(/\.tsx?/, '.d.ts')];

        /**
         * We always write an entry for /internal/X, even when it's isPublic is true, this is for
         * compatibility reasons. We should remove this once everything stops referencing public
         * APIs as internal.
         *
         * Known references:
         *
         * - VTA
         * - Design addon
         * - Addon kit
         *
         * I expect that we should be able to drop it in the process of of the release of 9.0, or
         * keep it for now, and drop it in the release of 9.1.
         */
        acc[key.replace('dist/', 'internal/')] = content;
        if (entry.isPublic) {
          acc[key.replace('dist/', '')] = content;
        }
        return acc;
      }, {}),
    },
  };

  await writeFile(location, `${sortPackageJson(JSON.stringify(pkgJson, null, 2))}\n`, {});
}
