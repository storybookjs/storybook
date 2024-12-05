import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { sortPackageJson } from '../../../../scripts/node_modules/sort-package-json';
import { generateMapperContent, mapCoreExportToSelf, write } from './utils';

/**
 * Update the `storybook` package's `exports` and `typesVersion` fields to expose all things exposed
 * from `@storybook/core` We do this to ensure that users that import `storybook/theming` will get
 * the code located at `@storybook/theming` (note the `@` symbol!)
 *
 * For every entry in `core/package.json`'s `exports` field, we:
 *
 * - Update the `exports` field in `package.json` to map the entry to the corresponding entry in
 *   `core`
 * - Write a new file in `core/X` that re-exports the entry from `@storybook/core/X`
 *
 * By reading from `core/package.json`, we ensure that we always have the correct exports.
 *
 * Removal is not handled here, so if entries are ever removed from `@storybook/core` we'll have to
 * remove those manually here.
 */
async function run() {
  const selfPackageJson = JSON.parse(
    await readFile(join(__dirname, '../package.json'), { encoding: 'utf8' })
  );
  const corePackageJson = await JSON.parse(
    await readFile(join(__dirname, '../../../core/package.json'), { encoding: 'utf8' })
  );

  await Promise.all(
    Object.entries<Record<string, string>>(corePackageJson.exports)
      .sort()
      .map(async ([key, input]) => {
        const value = mapCoreExportToSelf(input);
        if (key === './package.json') {
          return;
        }
        if (key.startsWith('./dist')) {
          return;
        }
        if (key === '.') {
          selfPackageJson.exports['./core'] = value;

          await Promise.all(
            Object.values(value).map(async (v) => {
              await write(join(__dirname, '..', v), generateMapperContent(v));
            })
          );
        } else {
          selfPackageJson.exports[key.replace('./', './internal/')] = value;
          await Promise.all(
            Object.values(value).map(async (v) => {
              await write(join(__dirname, '..', v), generateMapperContent(v));
            })
          );
        }
      })
  );

  type RecordOfStrings = Record<string, string[]>;

  selfPackageJson.typesVersions = {
    '*': {
      ...Object.entries(corePackageJson.typesVersions['*'] as RecordOfStrings)
        .sort()
        .reduce<RecordOfStrings>((acc, [key, value]) => {
          acc['internal/' + key] = value.map((v) => v.replace('./dist/', './core/'));
          return acc;
        }, {}),
      '*': ['./dist/index.d.ts'],
      'core-path': ['./dist/core-path.d.ts'],

      core: ['./core/index.d.ts'],
    },
  };

  await write(
    join(__dirname, '../package.json'),
    JSON.stringify(sortPackageJson(selfPackageJson), null, 2) + '\n'
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
