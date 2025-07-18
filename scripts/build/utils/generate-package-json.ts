import { readFile, writeFile } from 'node:fs/promises';

import { join } from 'pathe';
import sortPackageJson from 'sort-package-json';

import type { BuildEntries } from './entry-utils';

export async function generatePackageJsonFile(cwd: string, data: BuildEntries) {
  const location = join(cwd, 'package.json');
  const pkgJson = JSON.parse(await readFile(location, { encoding: 'utf8' }));

  const { entries } = data;

  // Add the package.json file to the exports, so we can use it to `require.resolve` the package's root easily
  pkgJson.exports = {
    './package.json': './package.json',
    ...data.extraOutputs,
  };

  for (const entry of Object.values(entries).flat()) {
    for (const exportEntry of entry.exportEntries ?? []) {
      const dtsPath = entry.entryPoint.replace('src', 'dist').replace(/\.tsx?/, '.d.ts');
      const jsPath = entry.entryPoint.replace('src', 'dist').replace(/\.tsx?/, '.js');

      if (entry.dts === undefined) {
        pkgJson.exports[exportEntry] = {
          types: dtsPath,
          default: jsPath,
        };
      } else {
        pkgJson.exports[exportEntry] = jsPath;
      }
    }
  }

  pkgJson.exports = sortObject(pkgJson.exports);

  await writeFile(location, `${sortPackageJson(JSON.stringify(pkgJson, null, 2))}\n`, {});
}

function sortObject(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}
