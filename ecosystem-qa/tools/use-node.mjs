#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';

// Never fails: a project without a version file keeps the image's Node, and the install log shows any engine problem.
const [version] = process.argv.slice(2);
spawnSync('n', [version ?? 'auto'], { stdio: 'inherit' });
const active = execFileSync('node', ['--version'], { encoding: 'utf8' }).trim();
console.log(`Node ${active} is active`);
