#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream, writeFileSync } from 'node:fs';

const [secondsFile, ...command] = process.argv.slice(2);
if (!secondsFile || command.length === 0) {
  console.error('Usage: node timed.mjs <seconds-file> <command...>');
  process.exit(2);
}

// The output is kept next to the timing, because the sandbox hook that runs this command does not
// log what the command printed, and a failed install is otherwise a bare exit code.
const log = createWriteStream(secondsFile.replace(/[^/\\]*$/, 'install.log'));
const started = Date.now();
const child = spawn(command.join(' '), { shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
for (const [source, target] of [
  [child.stdout, process.stdout],
  [child.stderr, process.stderr],
]) {
  source.on('data', (chunk) => {
    target.write(chunk);
    log.write(chunk);
  });
}
child.on('close', (status) => {
  writeFileSync(secondsFile, `${Math.round((Date.now() - started) / 1000)}\n`);
  log.end(() => process.exit(status ?? 1));
});
