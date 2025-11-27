import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

import { ROOT_DIRECTORY } from './constants';

const logger = console;

export const checkDependencies = async () => {
  if (!existsSync(join(ROOT_DIRECTORY, 'node_modules'))) {
    logger.log('installing dependencies');

    const task = spawn('yarn', ['install'], {
      cwd: ROOT_DIRECTORY,
      shell: true,
      stdio: ['inherit', 'inherit', 'inherit'],
    });

    await new Promise<void>((res, rej) => {
      task.on('exit', (code: number) => {
        if (code !== 0) {
          rej();
        } else {
          res();
        }
      });
    }).catch(() => {
      task.kill();
      throw new Error('Failed to install dependencies');
    });

    // give the filesystem some time
    await new Promise((res) => {
      setTimeout(res, 200);
    });
  }
};
