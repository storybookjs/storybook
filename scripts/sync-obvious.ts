import { execFileSync } from 'node:child_process';
import { renameSync, rmSync } from 'node:fs';

import { join } from 'pathe';

// Obvious reads skills with `git ls-tree` and `git show`, so symlinks reach it as one-line blobs and
// the copy has to be real files. Guidelines are copied too, because skills link to them with
// `../../guidelines/`. The copy comes from the git index, so a pre-commit hook syncs what is staged.
const SOURCES = ['skills', 'guidelines'];

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const staging = join(root, '.obvious', '.sync');

const tracked = execFileSync('git', ['ls-files', '-z', ...SOURCES.map((dir) => `.agents/${dir}`)], {
  cwd: root,
});

rmSync(staging, { recursive: true, force: true });
execFileSync('git', ['checkout-index', '--stdin', '-z', '--prefix=.obvious/.sync/'], {
  cwd: root,
  input: tracked,
});

for (const dir of SOURCES) {
  const target = join(root, '.obvious', dir);
  rmSync(target, { recursive: true, force: true });
  renameSync(join(staging, '.agents', dir), target);
}

rmSync(staging, { recursive: true, force: true });
