// CI helper: copies validated PNG screenshots from `$SOURCE` into a clone
// of an action-agnostic asset side branch (default `_agentic-pr-assets`),
// commits, pushes, and emits a JSON array of `{ rel, url }` pairs
// (raw.githubusercontent.com URLs pinned to the just-pushed commit).
//
// Replaces the inline 80-line bash block in
// `.github/workflows/verify-pr.yml`. Per-file (5 MB) and total-bundle
// (50 MB) caps + PNG mime-type validation preserve B5 acceptance criteria.
//
// Invocation:
//   node ./scripts/verify/ci/push-screenshots.ts \
//     --source <path-to-.verify-output> \
//     --pr <pr-number> \
//     --run-id <github-run-id> \
//     --repo <owner/repo> \
//     --assets-dir <staging-clone-dir>
//
// Reads `GITHUB_TOKEN` from env. Writes `urls=<json>` (heredoc) to the
// `--output` file when provided (typically `$GITHUB_OUTPUT`).

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  openSync,
  readSync,
  closeSync,
  rmSync,
  statSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// Action-agnostic default. Callers running other agentic workflows can
// override via --branch to keep their asset history separate. Renamed from
// the original verify-specific `_verify-screenshots` so the side branch
// can host other agentic-action assets without bleeding semantics.
const DEFAULT_BRANCH = '_agentic-pr-assets';

interface Args {
  source: string;
  pr: string;
  runId: string;
  repo: string;
  assetsDir: string;
  branch: string;
  output?: string;
}

function parseCliArgs(argv: string[]): Args {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: { type: 'string' },
      pr: { type: 'string' },
      'run-id': { type: 'string' },
      repo: { type: 'string' },
      'assets-dir': { type: 'string' },
      branch: { type: 'string' },
      output: { type: 'string' },
    },
    strict: true,
  });
  if (!values.source || !values.pr || !values['run-id'] || !values.repo || !values['assets-dir']) {
    throw new Error(
      'usage: push-screenshots --source <dir> --pr <num> --run-id <id> --repo <owner/repo> --assets-dir <dir> [--branch <name>] [--output <path>]'
    );
  }
  return {
    source: values.source,
    pr: values.pr,
    runId: values['run-id'],
    repo: values.repo,
    assetsDir: values['assets-dir'],
    branch: values.branch || DEFAULT_BRANCH,
    output: values.output,
  };
}

function findPngs(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: any[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name.endsWith('.png')) out.push(full);
    }
  };
  walk(root);
  return out;
}

// PNG mime via 8-byte magic header. Avoids depending on `file --mime-type`
// from the runner image. Exported so verify-evidence-check.ts can reuse it
// for asset validation.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export function isPng(path: string): boolean {
  let fd: number | null = null;
  try {
    fd = openSync(path, 'r');
    const buf = Buffer.alloc(8);
    const n = readSync(fd, buf, 0, 8, 0);
    if (n < 8) return false;
    return buf.equals(PNG_MAGIC);
  } catch {
    return false;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

// Author args used for every commit. Branch history is attributed to
// github-actions[bot] regardless of which agentic-action side branch
// (default `_agentic-pr-assets`) the caller uses.
const GIT_AUTHOR_ARGS = [
  '-c',
  'user.email=actions@github.com',
  '-c',
  'user.name=github-actions[bot]',
];

function git(cwd: string, args: string[], opts: { allowFail?: boolean } = {}): string {
  const res = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (res.status !== 0 && !opts.allowFail) {
    throw new Error(
      `git ${args.join(' ')} failed in ${cwd}: ${res.stderr || res.stdout || res.error?.message}`
    );
  }
  return (res.stdout ?? '').trim();
}

function setOutput(outputPath: string, key: string, value: string): void {
  // Heredoc-style multi-line capture for `$GITHUB_OUTPUT`.
  appendFileSync(outputPath, `${key}<<EOF\n${value}\nEOF\n`, 'utf-8');
}

function main(args: Args): void {
  const source = resolve(args.source);
  const assetsDir = resolve(args.assetsDir);
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required');

  const pngs = findPngs(source);
  if (pngs.length === 0) {
    console.log('no screenshots produced — skipping side-branch push');
    if (args.output) setOutput(args.output, 'urls', '[]');
    return;
  }

  const authUrl = `https://x-access-token:${token}@github.com/${args.repo}.git`;

  // Try cloning the existing side branch; otherwise bootstrap an orphan.
  const branch = args.branch;
  const clone = spawnSync(
    'git',
    [
      '-c',
      'protocol.version=2',
      'clone',
      '--depth',
      '1',
      '--branch',
      branch,
      authUrl,
      assetsDir,
    ],
    { encoding: 'utf-8' }
  );
  if (clone.status !== 0) {
    console.log(`side branch missing — creating orphan ${branch}`);
    git('.', ['-c', 'protocol.version=2', 'clone', '--depth', '1', authUrl, assetsDir]);
    git(assetsDir, [...GIT_AUTHOR_ARGS, 'checkout', '--orphan', branch]);
    git(assetsDir, ['rm', '-rf', '.'], { allowFail: true });
    writeFileSync(
      join(assetsDir, 'README.md'),
      'Agentic-PR assets side branch. Auto-managed; do not edit.\n',
      'utf-8'
    );
    git(assetsDir, ['add', 'README.md']);
    git(assetsDir, [...GIT_AUTHOR_ARGS, 'commit', '-m', `chore: init ${branch} branch`]);
    git(assetsDir, ['push', 'origin', branch]);
  } else {
    console.log(`cloned existing ${branch} branch`);
  }

  const prDir = join(assetsDir, `pr-${args.pr}`, args.runId);
  rmSync(prDir, { recursive: true, force: true });
  mkdirSync(prDir, { recursive: true });

  const MAX_PER_FILE = 5 * 1024 * 1024;
  const MAX_TOTAL = 50 * 1024 * 1024;
  for (const src of pngs) {
    if (!isPng(src)) {
      console.log(`[push-screenshots] skip non-png (magic mismatch): ${src}`);
      continue;
    }
    const size = statSync(src).size;
    if (size > MAX_PER_FILE) {
      console.log(`[push-screenshots] skip oversized (${size}B > 5MB): ${src}`);
      continue;
    }
    const rel = relative(source, src);
    const dest = join(prDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }

  // Total-bundle cap.
  let total = 0;
  for (const f of findPngs(prDir)) total += statSync(f).size;
  if (total > MAX_TOTAL) {
    console.error(`[push-screenshots] screenshot bundle >50MB (${total}B) — refusing to push`);
    process.exit(1);
  }

  git(assetsDir, ['add', `pr-${args.pr}/${args.runId}`]);
  const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: assetsDir });
  if (diff.status === 0) {
    console.log('no new screenshots to commit');
    if (args.output) setOutput(args.output, 'urls', '[]');
    return;
  }
  git(assetsDir, [
    ...GIT_AUTHOR_ARGS,
    'commit',
    '-m',
    `verify: PR #${args.pr} run ${args.runId}`,
  ]);
  git(assetsDir, ['push', 'origin', branch]);
  const commitSha = git(assetsDir, ['rev-parse', 'HEAD']);

  const base = `https://raw.githubusercontent.com/${args.repo}/${commitSha}/pr-${args.pr}/${args.runId}`;
  const urls = findPngs(prDir).map((p) => {
    const rel = relative(prDir, p);
    return { rel, url: `${base}/${rel}` };
  });
  const urlsJson = JSON.stringify(urls);
  console.log(`pushed ${urls.length} screenshot(s) at commit ${commitSha}`);
  if (args.output) setOutput(args.output, 'urls', urlsJson);
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    main(parseCliArgs(process.argv.slice(2)));
  } catch (err: any) {
    console.error('[push-screenshots] error:', err?.message ?? err);
    process.exit(1);
  }
}
