import { spawn } from 'node:child_process';
import { appendFile, writeFileSync } from 'node:fs';

const logger = console;

writeFileSync('reset.log', '');

const cleaningProcess = spawn('git', [
  'clean',
  '-xdf',
  '-n',
  '--exclude="/.vscode"',
  '--exclude="/.idea"',
]);

cleaningProcess.stdout.on('data', (data) => {
  appendFile('reset.log', data, (err) => {
    if (err) {
      throw err;
    }
  });
});
cleaningProcess.on('exit', (code) => {
  if (code === 0) {
    logger.log('all went well, files are being trashed now');
  } else {
    logger.error(code);
  }
});
