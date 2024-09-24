import { join, relative } from 'node:path';

import { spawn } from '../../../../scripts/prepare/tools';
import { chalk, limit, process } from '../../../../scripts/prepare/tools';
import type { getEntries } from '../entries';

export async function generateTypesFiles(
  entries: ReturnType<typeof getEntries>,
  isOptimized: boolean,
  cwd: string
) {
  const dtsEntries = entries.filter((e) => e.dts).map((e) => e.file);

  if (isOptimized) {
    // Spawn each entry in it's own separate process, because they are slow & synchronous
    // ...this way we do not bog down the main process/esbuild and can run them in parallel
    // we limit the number of concurrent processes to 3, because we don't want to overload the host machine
    // by trial and error, 3 seems to be the sweet spot between perf and consistency
    const limited = limit(10);
    let processes: ReturnType<typeof spawn>[] = [];

    await Promise.all(
      dtsEntries.map(async (fileName, index) => {
        return limited(async () => {
          const getDtsProcess = () =>
            spawn(
              join(__dirname, '../../../../scripts/node_modules/.bin/jiti'),
              ['./scripts/dts.ts', index.toString()],
              {
                cwd,
                stdio: ['ignore', 'pipe', 'inherit'],
              }
            );
          let timer: ReturnType<typeof setTimeout> | undefined;
          const dtsProcess = getDtsProcess();
          processes.push(dtsProcess);

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
                console.log(index, fileName);

                dtsProcess.kill(408); // timed out
                resolve(void 0);
              }, 60000);
            }),
          ]);

          if (timer) {
            clearTimeout(timer);
          }

          if (dtsProcess.exitCode !== 0) {
            console.log(dtsProcess.exitCode);
            // If any fail, kill all the other processes and exit (bail)
            processes.forEach((p) => p.kill());
            processes = [];
            console.log(index, fileName);
            process.exit(dtsProcess.exitCode || 1);
          } else {
            console.log('Generated types for', chalk.cyan(relative(cwd, dtsEntries[index])));
          }
        });
      })
    );
  }
}
