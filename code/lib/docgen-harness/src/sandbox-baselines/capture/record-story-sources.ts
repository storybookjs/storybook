import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SandboxBaselineError } from '../error.ts';
import { readStorySource } from './story-source.ts';
import { stableStringify } from '../stable-stringify.ts';

const [rootArg, out] = process.argv.slice(2);
if (!rootArg || !out)
  throw new SandboxBaselineError('Usage: record-story-sources.ts <project-root> <output.json>');
const root = resolve(rootArg);
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha = git('rev-parse', 'HEAD');
const files = git('ls-files', '-co', '--exclude-standard', '-z').split('\0').filter(Boolean);
const stories = [...new Set(files)]
  .filter((path) => /\.(stories|story)\.(svelte|[cm]?[jt]sx?)$/.test(path))
  .map((path) => readStorySource(root, `./${path}`, sha));
writeFileSync(out, stableStringify(stories) + '\n');
