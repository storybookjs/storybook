// A build is one version of the Storybook monorepo packages, installed into a test project.
//
//   local:<path>   A compiled storybookjs/storybook checkout. Every public workspace is packed with
//                  `yarn pack` (which rewrites `workspace:` ranges) into a cache folder keyed by the
//                  git tree of `code/` plus a hash of uncommitted changes under `code/`.
//   canary:<sha>   pkg.pr.new canaries of storybookjs/storybook at <sha> (7-40 hex chars).
//
// `resolveBuild` returns { key, label, kind, spec(name) }, where spec(name) is the dependency
// specifier a project puts in package.json for monorepo package `name`.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { log, sh } from './util.mjs';

export function parseRef(ref) {
  const match = /^(local|canary):(.+)$/.exec(ref ?? '');
  if (!match) {
    throw new Error(`Build ref must be local:<path> or canary:<sha>, got "${ref}"`);
  }
  const [, kind, value] = match;
  if (kind === 'canary' && !/^[0-9a-f]{7,40}$/.test(value)) {
    throw new Error(`canary:<sha> needs a 7-40 char hex sha, got "${value}"`);
  }
  return kind === 'local'
    ? { kind, path: resolve(value.replace(/^~(?=\/)/, process.env.HOME)) }
    : { kind, sha: value };
}

export async function resolveBuild(ref, { workDir }) {
  const parsed = parseRef(ref);
  return parsed.kind === 'canary' ? canaryBuild(parsed.sha) : localBuild(parsed.path, workDir);
}

function canaryBuild(sha) {
  return {
    kind: 'canary',
    key: `canary-${sha.slice(0, 10)}`,
    label: `canary ${sha.slice(0, 10)}`,
    sha,
    spec: (name) => `https://pkg.pr.new/storybookjs/storybook/${name}@${sha}`,
  };
}

async function localBuild(checkout, workDir) {
  if (!existsSync(join(checkout, 'code/core/package.json'))) {
    throw new Error(
      `${checkout} is not a storybookjs/storybook checkout (no code/core/package.json)`
    );
  }
  if (!existsSync(join(checkout, 'code/core/dist'))) {
    throw new Error(
      `${checkout} is not compiled. Run: cd ${checkout} && yarn && yarn nx run-many -t compile -c production`
    );
  }
  const git = (...args) => sh('git', ['-C', checkout, ...args]);
  const head = git('rev-parse', 'HEAD');
  const codeTree = git('rev-parse', 'HEAD:code');
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  // Uncommitted changes under code/ (tracked diffs and untracked, non-ignored files).
  const dirtyText =
    git('status', '--porcelain', '--untracked-files=all', '--', 'code') +
    git('diff', 'HEAD', '--', 'code');
  const dirty =
    dirtyText.length > 0 ? createHash('sha256').update(dirtyText).digest('hex').slice(0, 8) : '';
  const key = `local-${codeTree.slice(0, 10)}${dirty ? `-dirty-${dirty}` : ''}`;
  const dir = join(workDir, 'builds', key);
  const manifestPath = join(dir, 'manifest.json');

  if (!existsSync(manifestPath)) {
    log(
      `packing ${checkout} (${branch} @ ${head.slice(0, 10)}${dirty ? ', dirty' : ''}) into ${dir}`
    );
    const tmp = `${dir}.tmp`;
    await rm(tmp, { recursive: true, force: true });
    await mkdir(tmp, { recursive: true });
    const workspaces = sh('yarn', ['workspaces', 'list', '--json', '--no-private'], {
      cwd: checkout,
    })
      .split('\n')
      .map((line) => JSON.parse(line))
      .filter((w) => w.location !== '.');
    const packages = {};
    for (const { location, name } of workspaces) {
      const file = join(tmp, `${name.replace('@', '').replace('/', '__')}.tgz`);
      sh('yarn', ['pack', '--out', file], { cwd: join(checkout, location) });
      packages[name] = file.replace(tmp, dir);
    }
    await writeFile(
      join(tmp, 'manifest.json'),
      JSON.stringify(
        { checkout, head, branch, codeTree, dirty, packedAt: new Date().toISOString(), packages },
        null,
        2
      )
    );
    await rm(dir, { recursive: true, force: true });
    await rename(tmp, dir);
    log(`packed ${Object.keys(packages).length} packages`);
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  return {
    kind: 'local',
    key,
    label: `local ${manifest.branch} @ ${manifest.head.slice(0, 10)}${dirty ? ' + uncommitted' : ''}`,
    sha: manifest.head,
    codeTree,
    spec: (name) => {
      const file = manifest.packages[name];
      if (!file) {
        throw new Error(`${checkout} has no public workspace named ${name}`);
      }
      return `file:${file}`;
    },
  };
}
