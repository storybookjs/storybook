import { sync as spawnSync } from 'cross-spawn';

type ExecOptions = Parameters<typeof spawnSync>[2];

export const exec = async (command: string, options: ExecOptions = {}) =>
  new Promise((resolve, reject) => {
    const x = spawnSync(command, options);
    if (x.status === 0) {
      resolve(undefined);
    } else {
      reject(new Error(`command exited with code: ${x.status}: `));
    }
  });
