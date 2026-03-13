import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';

import { build } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

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
  const outputDir = join(process.cwd(), dir);

  const result = await build({
    input: entryPoint,
    external: (id: string) => {
      return external.some(
        (dep) =>
          id === dep ||
          id.startsWith(`${dep}/`) ||
          id.includes(`${sep}node_modules${sep}${dep}${sep}`)
      );
    },
    output: {
      dir: outputDir,
      format: 'es',
    },
    plugins: [
      dts({
        tsconfig: join(process.cwd(), 'tsconfig.json'),
        emitDtsOnly: true,
        resolver: 'oxc',
        compilerOptions: {
          esModuleInterop: true,
          baseUrl: '.',
          jsx: 'react',
          declaration: true,
          noEmit: false,
          emitDeclarationOnly: true,
          noEmitOnError: true,
          checkJs: false,
          declarationMap: false,
          skipLibCheck: true,
          preserveSymlinks: false,
          target: 'ESNext',
        },
      }),
    ],
    write: false,
  });

  const { output } = result;
  await mkdir(outputDir, { recursive: true });
  for (const item of output) {
    if (item.type === 'chunk') {
      const filePath = join(outputDir, item.fileName);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, item.code);
    } else {
      throw new Error(
        `Unexpected output type: ${item.type} for ${entryPoint} (${(item as { fileName?: string }).fileName})`
      );
    }
  }
}

run();
