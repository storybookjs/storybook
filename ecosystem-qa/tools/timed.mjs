#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [secondsFile, ...command] = process.argv.slice(2);
if (!secondsFile || command.length === 0) {
  console.error('Usage: node timed.mjs <seconds-file> <command...>');
  process.exit(2);
}

const started = Date.now();
const { status } = spawnSync(command.join(' '), { shell: true, stdio: 'inherit' });
writeFileSync(secondsFile, `${Math.round((Date.now() - started) / 1000)}\n`);
process.exit(status ?? 1);
