import { writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';

import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import { JsxEmit, ScriptTarget } from 'typescript';

import { getExternal } from './entry-utils';

async function run() {
  const [entryPoint] = process.argv.slice(2);

  if (!entryPoint) {
    throw new Error(
      'No entry point provided. Usage: jiti scripts/build/utils/dts-process.ts <entryPoint>'
    );
  }
  const { typesExternal: external } = await getExternal(process.cwd());

  const dir = dirname(entryPoint).replace('src', 'dist');
  const outputFile = entryPoint.replace('src', 'dist').replace(/\.tsx?/, '.d.ts');
  const out = await rollup({
    input: entryPoint,
    external: (id) => {
      return external.some(
        (dep) => id === dep || id.startsWith(`${dep}/`) || id.includes(`${sep}node_modules${sep}${dep}${sep}`)
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
