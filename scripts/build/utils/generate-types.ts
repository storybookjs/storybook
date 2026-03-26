import { spawn } from 'child_process';
import { existsSync } from 'node:fs';
import { join, relative } from 'pathe';
import picocolors from 'picocolors';

import { ROOT_DIRECTORY } from '../../utils/constants';
import type { BuildEntries } from './entry-utils';

const DIR_CODE = join(import.meta.dirname, '..', '..', '..', 'code');

/** Split entries into N roughly equal batches using round-robin. */
function splitIntoBatches(entries: string[], batchCount: number): string[][] {
  const batches: string[][] = Array.from({ length: batchCount }, () => []);
  for (let i = 0; i < entries.length; i++) {
    batches[i % batchCount].push(entries[i]);
  }
  return batches.filter((b) => b.length > 0);
}

function spawnDtsBatch(
  cwd: string,
  entries: string[]
): Promise<{ exitCode: number | null }> {
  return new Promise((resolve) => {
    const dtsProcess = spawn(
      `"${join(ROOT_DIRECTORY, 'node_modules', '.bin', 'jiti')}"`,
      [
        `"${join(import.meta.dirname, 'dts-process.ts')}"`,
        ...entries.map((e) => `"${e}"`),
      ],
      {
        shell: true,
        cwd,
        stdio: ['ignore', 'inherit', 'pipe'],
        env: {
          ...process.env,
          NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=8192`.trim(),
        },
      }
    );

    // Filter stderr to exclude ignorable rollup warnings
    dtsProcess.stderr?.on('data', (data) => {
      const message = data.toString();
      if (!message.includes('are imported from external module')) {
        process.stderr.write(data);
      }
    });

    const timer = setTimeout(() => {
      console.log('⌛ Timed out generating d.ts files');
      dtsProcess.kill('SIGTERM');
      resolve({ exitCode: 1 });
    }, 600000); // 10 minutes

    dtsProcess.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code });
    });
    dtsProcess.on('error', () => {
      clearTimeout(timer);
      resolve({ exitCode: 1 });
    });
  });
}

export async function generateTypesFiles(cwd: string, data: BuildEntries) {
  const DIR_REL = relative(DIR_CODE, cwd);

  const dtsEntries = Object.values(data.entries)
    .flat()
    .filter((entry) => entry.dts !== false)
    .map((e) => e.entryPoint);

  if (dtsEntries.length === 0) {
    return;
  }

  // Batch entries so each process amortizes module loading and benefits from OS file cache.
  // Each batch runs in its own process for multi-core utilization.
  const BATCH_COUNT = dtsEntries.length <= 4 ? dtsEntries.length : 4;
  const batches = splitIntoBatches(dtsEntries, BATCH_COUNT);

  // Phase 1: Run all batches in parallel.
  // Some entries may fail due to cross-batch dependencies (e.g. mocking-utils depends on babel's d.ts).
  await Promise.allSettled(batches.map((batch) => spawnDtsBatch(cwd, batch)));

  // Phase 2: Check which entries are still missing and retry them.
  // By now all batches have completed, so cross-batch dependencies are resolved.
  const missingEntries = dtsEntries.filter((entry) => {
    const outputFile = join(cwd, entry.replace('src', 'dist').replace(/\.tsx?$/, '.d.ts'));
    return !existsSync(outputFile);
  });

  if (missingEntries.length > 0) {
    console.warn(
      `⚠️ ${missingEntries.length} entries missing after initial pass, retrying:`,
      missingEntries.map((e) => relative(cwd, e)).join(', ')
    );
    const { exitCode } = await spawnDtsBatch(cwd, missingEntries);

    if (exitCode !== 0) {
      console.error('\n❌ Generating types for', picocolors.cyan(DIR_REL), 'failed');
      process.exit(exitCode || 1);
    }
  }

  if (!process.env.CI) {
    for (const entry of dtsEntries) {
      console.log('✅ Generated types for', picocolors.cyan(join(DIR_REL, entry)));
    }
  }
}
