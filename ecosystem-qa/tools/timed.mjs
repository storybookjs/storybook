#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream, writeFileSync } from 'node:fs';

const [secondsFile, ...command] = process.argv.slice(2);
if (!secondsFile || command.length === 0) {
  console.error('Usage: node timed.mjs <seconds-file> <command...>');
  process.exit(2);
}

// The output and the exit status are kept next to the timing. The agent reads them and repairs the
// environment, so a failed install must not end the run: this script always exits 0.
const directory = secondsFile.replace(/[^/\\]*$/, '');
const log = createWriteStream(`${directory}install.log`);
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
  writeFileSync(`${directory}install-exit.txt`, `${status ?? 1}\n`);
  log.end(() => process.exit(0));
});
