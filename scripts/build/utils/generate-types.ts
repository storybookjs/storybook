import { sep } from 'node:path';

import { join, relative } from 'pathe';
import picocolors from 'picocolors';
import { rolldown } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

import type { BuildEntries } from './entry-utils';
import { getExternal } from './entry-utils';

const DIR_CODE = join(import.meta.dirname, '..', '..', '..', 'code');

export async function generateTypesFiles(cwd: string, data: BuildEntries) {
  const DIR_REL = relative(DIR_CODE, cwd);

  const dtsEntries = Object.values(data.entries)
    .flat()
    .filter((entry) => entry.dts !== false)
    .map((e) => e.entryPoint);

  if (dtsEntries.length === 0) {
    return;
  }

  const { typesExternal: external } = await getExternal(cwd);

  const externalFn = (id: string) =>
    external.some(
      (dep: string) =>
        id === dep ||
        id.startsWith(`${dep}/`) ||
        id.includes(`${sep}node_modules${sep}${dep}${sep}`)
    );

  // Build entry map: { 'client-logger/index': '/absolute/path/src/client-logger/index.ts', ... }
  const entryMap: Record<string, string> = {};
  for (const entry of dtsEntries) {
    // ./src/client-logger/index.ts -> client-logger/index
    const name = entry.replace(/^\.\/src\//, '').replace(/\.tsx?$/, '');
    entryMap[name] = join(cwd, entry);
  }

  // Use rolldown + rolldown-plugin-dts with tsgo for fast d.ts generation.
  // tsgo (Go-based TypeScript compiler) runs once for all entries (~7s),
  // then rolldown bundles the declarations natively in Rust.
  const out = await rolldown({
    input: entryMap,
    external: externalFn,
    plugins: [
      dts({
        cwd,
        tsconfig: join(cwd, 'tsconfig.json'),
        tsgo: true,
        emitDtsOnly: true,
      }),
    ],
    logLevel: 'warn',
  });

  await out.write({ dir: join(cwd, 'dist'), format: 'es' });

  if (!process.env.CI) {
    for (const entry of dtsEntries) {
      console.log('Generated types for', picocolors.cyan(join(DIR_REL, entry)));
    }
  }
}
