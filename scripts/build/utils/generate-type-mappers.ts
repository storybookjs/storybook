import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

import { dedent } from 'ts-dedent';

import type { BuildEntries } from './entry-utils';

async function generateTypesMapperContent(filePath: string, cwd: string) {
  const upwards = relative(join(filePath, '..'), cwd);
  const downwards = relative(cwd, filePath);

  return dedent`
    // auto generated file from ${import.meta.url}, do not edit
    export * from '${join(upwards, downwards).replaceAll(sep, '/')}';
    export type * from '${join(upwards, downwards).replaceAll(sep, '/')}';
  `;
}

export async function generateTypesMapperFiles(cwd: string, data: BuildEntries) {
  /**
   * Generate the type mapper files, which are used to map the types to the SOURCE location. This
   * would be for development builds ONLY, **HOWEVER**: During a production build we ALSO run this,
   * because we want to generate a `d.ts` file for each entry in parallel. By generating these files
   * (in parallel) first, we can then ensure we can compile the actual type definitions in parallel.
   * This is because the type definitions have interdependencies between them. These
   * interdependencies are MEGA complex, and this simplified approach immensely is the only way to
   * ensure we can compile them in parallel.
   */

  const dtsEntries = Object.values(data.entries)
    .flat()
    .filter((entry) => entry.dts !== false);

  const all = dtsEntries.filter((e) => e.dts !== false).map((e) => e.entryPoint);

  await Promise.all(
    all.map(async (filePath) => {
      const location = filePath.replace('src', 'dist').replace(/\.tsx?/, '.d.ts');
      if (!existsSync(location)) {
        const directory = dirname(location);
        await mkdir(directory, { recursive: true });
      }
      await writeFile(location, await generateTypesMapperContent(filePath, cwd));
    })
  );
}
