import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';

import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import { JsxEmit, ScriptTarget } from 'typescript';

import { getExternal } from './entry-utils';

/**
 * Build TypeScript `paths` for self-referential imports.
 *
 * When multiple dts-processes run in parallel, one process may try to resolve an import like
 * `storybook/internal/csf` before the dts-process for the `csf` entry has written its output
 * (`dist/csf/index.d.ts`). TypeScript resolves these via the package.json `types` export condition,
 * which points to dist files that may not exist yet.
 *
 * By mapping these imports to source files via TypeScript `paths`, we eliminate this race
 * condition: TypeScript resolves types from source instead of dist, regardless of whether other
 * dts-processes have finished.
 */
function getSelfReferencePaths(cwd: string): Record<string, string[]> {
  const packageJson = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'));
  const packageName: string = packageJson.name;
  const paths: Record<string, string[]> = {};

  if (packageJson.exports) {
    for (const [exportPath, exportValue] of Object.entries(packageJson.exports)) {
      if (typeof exportValue === 'object' && exportValue !== null && 'code' in exportValue) {
        const importPath =
          exportPath === '.' ? packageName : `${packageName}/${exportPath.slice(2)}`;
        paths[importPath] = [(exportValue as Record<string, string>).code];
      }
    }
  }

  return paths;
}

async function run() {
  const [entryPoint] = process.argv.slice(2);

  if (!entryPoint) {
    throw new Error(
      'No entry point provided. Usage: jiti scripts/build/utils/dts-process.ts <entryPoint>'
    );
  }
  const { typesExternal: external } = await getExternal(process.cwd());
  const selfReferencePaths = getSelfReferencePaths(process.cwd());

  const dir = dirname(entryPoint).replace('src', 'dist');
  const outputFile = entryPoint.replace('src', 'dist').replace(/\.tsx?/, '.d.ts');
  const out = await rollup({
    input: entryPoint,
    external: (id) => {
      return external.some(
        (dep) =>
          id === dep ||
          id.startsWith(`${dep}/`) ||
          id.includes(`${sep}node_modules${sep}${dep}${sep}`)
      );
    },
    output: { file: outputFile, format: 'es' },
    plugins: [
      dts({
        respectExternal: true,
        tsconfig: join(process.cwd(), 'tsconfig.json'),
        compilerOptions: {
          esModuleInterop: true,
          baseUrl: '.',
          jsx: JsxEmit.React,
          declaration: true,
          noEmit: false,
          emitDeclarationOnly: true,
          noEmitOnError: true,
          checkJs: false,
          declarationMap: false,
          skipLibCheck: true,
          preserveSymlinks: false,
          target: ScriptTarget.ESNext,
          ...(Object.keys(selfReferencePaths).length > 0 ? { paths: selfReferencePaths } : {}),
        },
      }),
    ],
  });
  const { output } = await out.generate({
    format: 'es',
    file: outputFile,
  });

  await Promise.all(
    output.map(async (o) => {
      if (o.type === 'chunk') {
        await writeFile(join(dir, o.fileName), o.code);
      } else {
        throw new Error(`Unexpected output type: ${o.type} for ${entryPoint} (${o.fileName})`);
      }
    })
  );
}

run();
