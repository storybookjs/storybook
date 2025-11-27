import { spawn } from 'child_process';
import limit from 'p-limit';
import { join, relative } from 'pathe';
import picocolors from 'picocolors';

import { ROOT_DIRECTORY } from '../../utils/constants';
import type { BuildEntries } from './entry-utils';
import { modifyCoreThemeTypes } from './modify-core-theme-types';

const DIR_CODE = join(import.meta.dirname, '..', '..', '..');

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
  const limited = limit(10);
  let processes: ReturnType<typeof spawn>[] = [];

  await Promise.all(
    dtsEntries.map(async (entryPoint) => {
      return limited(async () => {
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

              dtsProcess.kill(408); // timed out
              resolve(void 0);
            }, 120000);
          }),
        ]);

        if (timer) {
          clearTimeout(timer);
        }

        if (dtsProcess.exitCode !== 0) {
          console.error(
            '\n❌ Generating types for',
            picocolors.cyan(relative(cwd, entryPoint)),
            ' failed'
          );
          // If any fail, kill all the other processes and exit (bail)
          processes.forEach((p) => p.kill());
          processes = [];
          process.exit(dtsProcess.exitCode || 1);
        } else {
          console.log('✅ Generated types for', picocolors.cyan(join(DIR_REL, entryPoint)));

          if (entryPoint.includes('src/theming/index')) {
            await modifyCoreThemeTypes(cwd);
          }
        }
      });
    })
  );
}
