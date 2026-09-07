import { spawn } from 'child_process';
import limit from 'p-limit';
import { join, relative } from 'pathe';
import picocolors from 'picocolors';

import type { BuildEntries } from './entry-utils.ts';

// Computed locally instead of importing scripts/utils/constants.ts: that
// module must stay CJS-compatible for Playwright consumers, while this one
// runs as native ESM.
const ROOT_DIRECTORY = join(import.meta.dirname, '..', '..', '..');
const DIR_CODE = join(ROOT_DIRECTORY, 'code');

const MAX_DTS_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;

export async function generateTypesFiles(cwd: string, data: BuildEntries) {
  const DIR_CWD = cwd;
  const DIR_REL = relative(DIR_CODE, DIR_CWD);

  const dtsEntries = Object.values(data.entries)
    .flat()
    .filter((entry) => entry.dts !== false)
    .map((e) => e.entryPoint);

  // Spawn each entry in it's own separate process, because they are slow & synchronous
  // ...this way we do not bog down the main process/esbuild and can run them in parallel
  // we limit the number of concurrent processes to 3, because we don't want to overload the host machine
  // by trial and error, 3 seems to be the sweet spot between perf and consistency
  const limited = limit(5);
  let processes: ReturnType<typeof spawn>[] = [];

  await Promise.all(
    dtsEntries.map(async (entryPoint) => {
      return limited(async () => {
        for (let attempt = 1; attempt <= MAX_DTS_ATTEMPTS; attempt++) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const dtsProcess = spawn(
            `"${join(ROOT_DIRECTORY, 'node_modules', '.bin', 'jiti')}"`,
            [`"${join(import.meta.dirname, 'dts-process.ts')}"`, `"${entryPoint}"`],
            {
              shell: true,
              cwd: DIR_CWD,
              stdio: ['ignore', 'inherit', 'pipe'],
            }
          );
          processes.push(dtsProcess);

          // Filter stderr to exclude messages containing "are imported from external module", which is an ignorable warning from rollup
          dtsProcess.stderr?.on('data', (data) => {
            const message = data.toString();
            if (!message.includes('are imported from external module')) {
              process.stderr.write(data);
            }
          });

          await Promise.race([
            new Promise((resolve) => {
              dtsProcess.on('exit', () => {
                resolve(void 0);
              });
              dtsProcess.on('error', () => {
                resolve(void 0);
              });
              dtsProcess.on('close', () => {
                resolve(void 0);
              });
            }),
            new Promise((resolve) => {
              timer = setTimeout(() => {
                console.log('⌛ Timed out generating d.ts files for', entryPoint);

                // ChildProcess.kill takes a signal, not an exit code; an invalid value like 408
                // throws ERR_UNKNOWN_SIGNAL and crashes the whole build instead of reaching the
                // retry logic below.
                dtsProcess.kill('SIGTERM');
                resolve(void 0);
              }, 120000);
            }),
          ]);

          if (timer) {
            clearTimeout(timer);
          }

          if (dtsProcess.exitCode !== 0) {
            if (attempt < MAX_DTS_ATTEMPTS) {
              // Race: parallel DTS can read a .d.ts another process is still writing → invalid. Retry + delay usually fixes (flake in core:compile:production since #33759).
              console.warn(
                `⚠️ DTS failed for ${picocolors.cyan(relative(cwd, entryPoint))}, retrying (${attempt}/${MAX_DTS_ATTEMPTS})...`
              );
              processes = processes.filter((p) => p !== dtsProcess);
              await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
              continue;
            }
            console.error(
              '\n❌ Generating types for',
              picocolors.cyan(relative(cwd, entryPoint)),
              ' failed'
            );
            // If any fail after all retries, kill all the other processes and exit (bail)
            processes.forEach((p) => p.kill());
            processes = [];
            process.exit(dtsProcess.exitCode || 1);
          }

          if (!process.env.CI) {
            console.log('✅ Generated types for', picocolors.cyan(join(DIR_REL, entryPoint)));
          }
          break;
        }
      });
    })
  );
}
