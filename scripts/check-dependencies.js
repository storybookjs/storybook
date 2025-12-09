// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

/**
 * This file needs to be run before any other script to ensure dependencies are installed Therefore,
 * we cannot transform this file to Typescript, because it would require esbuild to be installed
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as url from 'node:url';

const dirname = url.fileURLToPath(new URL('.', import.meta.url));

const ROOT_DIRECTORY = join(dirname, '..');

const logger = console;

const checkDependencies = async () => {
  if (!existsSync(join(ROOT_DIRECTORY, 'node_modules'))) {
    logger.log('installing dependencies');

    const task = spawn('yarn', ['install'], {
      cwd: ROOT_DIRECTORY,
      shell: true,
      stdio: ['inherit', 'inherit', 'inherit'],
    });

    await new Promise((res, rej) => {
      task.on('exit', (code) => {
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
      setTimeout(res, 1000);
    });
  }
};

checkDependencies().catch((e) => {
  console.error(e);
  process.exit(1);
});
