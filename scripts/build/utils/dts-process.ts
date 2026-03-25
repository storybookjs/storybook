import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';

import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import { JsxEmit, ScriptTarget } from 'typescript';

import { getExternal } from './entry-utils';

async function run() {
  const entryPoints = process.argv.slice(2);

  if (entryPoints.length === 0) {
    throw new Error(
      'No entry points provided. Usage: jiti scripts/build/utils/dts-process.ts <entryPoint> [...]'
    );
  }

  const { typesExternal: external } = await getExternal(process.cwd());

  const externalFn = (id: string) =>
    external.some(
      (dep: string) =>
        id === dep ||
        id.startsWith(`${dep}/`) ||
        id.includes(`${sep}node_modules${sep}${dep}${sep}`)
    );

  const dtsOptions = {
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
  };

  async function processEntry(entryPoint: string) {
    const dir = dirname(entryPoint).replace('src', 'dist');
    const outputFile = entryPoint.replace('src', 'dist').replace(/\.tsx?/, '.d.ts');

    await mkdir(dir, { recursive: true });

    const out = await rollup({
      input: entryPoint,
      external: externalFn,
      output: { file: outputFile, format: 'es' },
      plugins: [dts(dtsOptions)],
    });

    const { output } = await out.generate({ format: 'es', file: outputFile });

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

  // Process entries sequentially within this process.
  // Module loading (rollup, TS, etc.) happens once; OS file cache warms after the first entry.
  // Some entries depend on d.ts output from other entries, so retry failed entries
  // after all others have been processed (handles dependency ordering).
  let remaining = [...entryPoints];
  const MAX_PASSES = 3;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const failed: { entry: string; error: unknown }[] = [];

    for (const entryPoint of remaining) {
      try {
        await processEntry(entryPoint);
        console.log(`✅ ${entryPoint}`);
      } catch (err) {
        failed.push({ entry: entryPoint, error: err });
      }
    }

    if (failed.length === 0) {
      break;
    }

    if (failed.length === remaining.length) {
      // No progress made — all entries failed
      console.error(`\n❌ Failed to generate types for ${failed.length} entries (no progress):`);
      for (const { entry, error } of failed) {
        console.error(`  ${entry}: ${error instanceof Error ? error.message : error}`);
      }
      process.exit(1);
    }

    // Retry failed entries in the next pass
    console.warn(
      `⚠️ ${failed.length} entries failed, retrying (pass ${pass + 1}/${MAX_PASSES})...`
    );
    remaining = failed.map((f) => f.entry);
  }
}

run();
