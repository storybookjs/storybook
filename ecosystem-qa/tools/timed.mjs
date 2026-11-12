#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream, writeFileSync } from 'node:fs';
import { constants } from 'node:os';

import { useNode } from './use-node.mjs';

const args = process.argv.slice(2);
const nodeFlag = args[0]?.startsWith('--use-node') ? args.shift() : undefined;
const [secondsFile, ...command] = args;
if (!secondsFile || command.length === 0) {
  console.error('Usage: node timed.mjs [--use-node[=<version>]] <seconds-file> <command...>');
  process.exit(2);
}

// The output and the exit status are kept next to the timing. The agent reads them and repairs the
// environment, so a failed install must not end the run: this script always exits 0. An install that
// outlasts the timeout of the hook that runs this script still ends the run.
const directory = secondsFile.replace(/[^/\\]*$/, '');
const log = createWriteStream(`${directory}install.log`);

// Sandcastle starts every sandbox hook at once, so the Node switch cannot be a hook of its own: the
// install would start on the image's Node.
if (nodeFlag) {
  const switched = useNode(nodeFlag.split('=')[1]);
  console.log(switched);
  log.write(`${switched}\n`);
}

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
child.on('close', (status, signal) => {
  // A shell reports a child that a signal ended as 128 plus the signal number, and the agent is told
  // to read 137 as out of memory.
  const exit = status ?? 128 + (constants.signals[signal] ?? 0);
  writeFileSync(secondsFile, `${Math.round((Date.now() - started) / 1000)}\n`);
  writeFileSync(`${directory}install-exit.txt`, `${exit}\n`);
  log.end(() => process.exit(0));
});
