import { spawn } from 'child_process';
import { join, relative } from 'pathe';
import picocolors from 'picocolors';

import { ROOT_DIRECTORY } from '../../utils/constants';
import type { BuildEntries } from './entry-utils';

const DIR_CODE = join(import.meta.dirname, '..', '..', '..', 'code');

const MAX_DTS_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;

/** Split entries into N roughly equal batches using round-robin. */
function splitIntoBatches(entries: string[], batchCount: number): string[][] {
  const batches: string[][] = Array.from({ length: batchCount }, () => []);
  for (let i = 0; i < entries.length; i++) {
    batches[i % batchCount].push(entries[i]);
  }
  return batches.filter((b) => b.length > 0);
}

export async function generateTypesFiles(cwd: string, data: BuildEntries) {
  const DIR_CWD = cwd;
  const DIR_REL = relative(DIR_CODE, DIR_CWD);

  const dtsEntries = Object.values(data.entries)
    .flat()
    .filter((entry) => entry.dts !== false)
    .map((e) => e.entryPoint);

  if (dtsEntries.length === 0) {
    return;
  }

  // When there are many entries (like core with 27+), batch them so each process
  // shares a single TypeScript program via rollup multi-input.
  // This avoids creating redundant TS programs (the main bottleneck, ~10s each).
  // Each batch runs in its own process for multi-core utilization.
  // For packages with few entries, this falls back to one process per entry.
  const BATCH_COUNT = dtsEntries.length <= 4 ? dtsEntries.length : 4;
  const batches = splitIntoBatches(dtsEntries, BATCH_COUNT);

  let processes: ReturnType<typeof spawn>[] = [];

  await Promise.all(
    batches.map(async (batch, batchIndex) => {
      for (let attempt = 1; attempt <= MAX_DTS_ATTEMPTS; attempt++) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const dtsProcess = spawn(
          `"${join(ROOT_DIRECTORY, 'node_modules', '.bin', 'jiti')}"`,
          [
            `"${join(import.meta.dirname, 'dts-process.ts')}"`,
            ...batch.map((e) => `"${e}"`),
          ],
          {
            shell: true,
            cwd: DIR_CWD,
            stdio: ['ignore', 'inherit', 'pipe'],
            env: {
              ...process.env,
              NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=8192`.trim(),
            },
          }
        );
        processes.push(dtsProcess);

        // Filter stderr to exclude ignorable rollup warnings
        dtsProcess.stderr?.on('data', (data) => {
          const message = data.toString();
          if (!message.includes('are imported from external module')) {
            process.stderr.write(data);
          }
        });

        await Promise.race([
          new Promise((resolve) => {
            dtsProcess.on('exit', () => resolve(void 0));
            dtsProcess.on('error', () => resolve(void 0));
            dtsProcess.on('close', () => resolve(void 0));
          }),
          new Promise((resolve) => {
            timer = setTimeout(() => {
              console.log(
                '⌛ Timed out generating d.ts files for batch',
                batchIndex,
                `(${batch.length} entries)`
              );
              dtsProcess.kill('SIGTERM');
              resolve(void 0);
            }, 600000); // 10 minutes per batch
          }),
        ]);

        if (timer) {
          clearTimeout(timer);
        }

        if (dtsProcess.exitCode !== 0) {
          if (attempt < MAX_DTS_ATTEMPTS) {
            console.warn(
              `⚠️ DTS batch ${batchIndex} failed, retrying (${attempt}/${MAX_DTS_ATTEMPTS})...`
            );
            processes = processes.filter((p) => p !== dtsProcess);
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          console.error(
            '\n❌ Generating types for',
            picocolors.cyan(DIR_REL),
            `batch ${batchIndex} failed`
          );
          processes.forEach((p) => p.kill('SIGTERM'));
          processes = [];
          process.exit(dtsProcess.exitCode || 1);
        }

        if (!process.env.CI) {
          for (const entry of batch) {
            console.log('✅ Generated types for', picocolors.cyan(join(DIR_REL, entry)));
          }
        }
        break;
      }
    })
  );
}
