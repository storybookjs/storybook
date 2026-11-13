#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, writeFileSync } from 'node:fs';
import { constants } from 'node:os';

import { useNode } from './use-node.mjs';

// The exit status GNU timeout reports for a command it had to stop.
const STOPPED_AT_LIMIT = 124;

const args = process.argv.slice(2);
const flags = [];
while (args[0]?.startsWith('--')) {
  flags.push(args.shift());
}
const flag = (name) => flags.find((given) => given === name || given.startsWith(`${name}=`));
const nodeFlag = flag('--use-node');
const limitSeconds = Number(flag('--limit-seconds')?.split('=')[1]);
const [secondsFile, ...command] = args;
if (!secondsFile || command.length === 0) {
  console.error(
    'Usage: node timed.mjs [--use-node[=<version>]] [--limit-seconds=<n>] <seconds-file> <command...>'
  );
  process.exit(2);
}

// The output and the exit status are kept next to the timing. The agent reads them and repairs the
// environment, so a failed install must not end the run: this script always exits 0. An install
// that outlasts the limit is stopped and recorded with status 124, which the runner reads.
const directory = secondsFile.replace(/[^/\\]*$/, '');
const log = createWriteStream(`${directory}install.log`);
// One limit for the Node switch and the command together.
const deadline = Number.isFinite(limitSeconds) ? Date.now() + limitSeconds * 1000 : undefined;
const timeLeft = () => (deadline === undefined ? undefined : Math.max(0, deadline - Date.now()));

// Sandcastle starts every sandbox hook at once, so the Node switch cannot be a hook of its own: the
// install would start on the image's Node.
if (nodeFlag) {
  const switched = useNode(nodeFlag.split('=')[1], timeLeft());
  console.log(switched);
  log.write(`${switched}\n`);
}

const onWindows = process.platform === 'win32';
const started = Date.now();
const child = spawn(command.join(' '), {
  shell: true,
  stdio: ['inherit', 'pipe', 'pipe'],
  // A process group of its own, so the install and everything it started can be stopped at once.
  detached: !onWindows,
});
for (const [source, target] of [
  [child.stdout, process.stdout],
  [child.stderr, process.stderr],
]) {
  source.on('data', (chunk) => {
    target.write(chunk);
    log.write(chunk);
  });
}

let stoppedAtLimit = false;
const limit =
  deadline === undefined
    ? undefined
    : setTimeout(() => {
        stoppedAtLimit = true;
        log.write(`\nStopped: the command did not finish within ${limitSeconds} seconds.\n`);
        try {
          if (onWindows) {
            spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
          } else {
            process.kill(-child.pid, 'SIGKILL');
          }
        } catch {
          // The command ended on its own in the same moment.
        }
      }, timeLeft());

child.on('close', (status, signal) => {
  clearTimeout(limit);
  // A shell reports a child that a signal ended as 128 plus the signal number, and the agent is told
  // to read 137 as out of memory.
  const exit = stoppedAtLimit
    ? STOPPED_AT_LIMIT
    : (status ?? 128 + (constants.signals[signal] ?? 0));
  writeFileSync(secondsFile, `${Math.round((Date.now() - started) / 1000)}\n`);
  writeFileSync(`${directory}install-exit.txt`, `${exit}\n`);
  log.end(() => process.exit(0));
});
