import type { getEntries } from '../entries';
import { join, relative } from 'node:path';
import { dedent } from '../../../../scripts/prepare/tools';
import { writeFile } from 'node:fs/promises';
import { ensureFile } from '@ndelangen/fs-extra-unified';

const cwd = process.cwd();

async function generateTypesMapperContent(filePath: string) {
  const upwards = relative(join(filePath, '..'), cwd);
  const downwards = relative(cwd, filePath);

  return dedent`
    // auto generated file from ${__filename}, do not edit
    export * from '${join(upwards, downwards)}';
    export type * from '${join(upwards, downwards)}';
  `;
}

export async function generateTypesMapperFiles(entries: ReturnType<typeof getEntries>) {
  /** Generate the type mapper files, which are used to map the types to the SOURCE location.
   * This would be for development builds ONLY, **HOWEVER**:
   * During a production build we ALSO run this, because we want to generate a `d.ts` file for each entry in parallel.
   * By generating these files (in parallel) first, we can then ensure we can compile the actual type definitions in parallel.
   * This is because the type definitions have interdependencies between them.
   * These interdependencies are MEGA complex, and this simplified approach immensely is the only way to ensure we can compile them in parallel.
   */
  const all = entries.filter((e) => e.dts).map((e) => e.file);

  await Promise.all(
    all.map(async (filePath) => {
      const location = filePath.replace('src', 'dist').replace(/\.tsx?/, '.d.ts');
      await ensureFile(location);
      await writeFile(location, await generateTypesMapperContent(filePath));
    })
  );
}
