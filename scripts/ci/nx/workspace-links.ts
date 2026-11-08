// The links Yarn makes from node_modules into the repository (its workspaces and portals), for
// circleci-node-modules.sh. On Windows they are junctions, which tar copies as directories and
// CircleCI's cache leaves out, so the archives leave them out and a restore makes them again.
//
//   workspace-links.ts record  write the links of the tree to LINKS and print where each one is
//   workspace-links.ts make    make every link in LINKS that is missing or points elsewhere
//
// Runs under plain Node (`node --experimental-transform-types`) before anything is installed, from
// the repository root, with paths as circleci-node-modules.sh lists the node_modules directories
// (`./node_modules`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Every node_modules directory of the tree, as circleci-node-modules.sh lists them.
const DIRS = 'node_modules/.circleci-node-modules-dirs';
// Each link of the tree and what it points to, tab-separated; archived with the tree.
export const LINKS = 'node_modules/.circleci-node-modules-links';

const posix = (file: string) => file.split(path.sep).join('/');

// The links among the packages of each node_modules directory, scoped ones included, with paths
// relative to `root`.
export function record(root: string, dirs: readonly string[]) {
  const links: [string, string][] = [];
  const at = (file: string) => path.join(root, file);
  for (const dir of dirs) {
    for (const name of fs.readdirSync(at(dir))) {
      if (name.startsWith('.')) {
        continue;
      }
      const entries = name.startsWith('@')
        ? fs.readdirSync(at(`${dir}/${name}`)).map((scoped) => `${dir}/${name}/${scoped}`)
        : [`${dir}/${name}`];
      for (const entry of entries) {
        if (fs.lstatSync(at(entry)).isSymbolicLink()) {
          links.push([
            entry,
            posix(path.relative(fs.realpathSync(root), fs.realpathSync(at(entry)))),
          ]);
        }
      }
    }
  }
  return links;
}

export function make(root: string, links: readonly (readonly string[])[]) {
  let made = 0;
  for (const [location, target] of links) {
    const [link, to] = [path.resolve(root, location), path.resolve(root, target)];
    let current: string | undefined;
    try {
      current = fs.realpathSync(link);
    } catch {}
    if (current === fs.realpathSync(to)) {
      continue;
    }
    fs.rmSync(link, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(link), { recursive: true });
    // As Yarn links them: a junction on Windows, which needs no symlink privilege.
    if (process.platform === 'win32') {
      fs.symlinkSync(to, link, 'junction');
    } else {
      fs.symlinkSync(path.relative(path.dirname(link), to), link);
    }
    made++;
  }
  return made;
}

const [mode] = process.argv.slice(2);
const same = (a: string, b: string) =>
  path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
if (!same(process.argv[1] ?? '', fileURLToPath(import.meta.url))) {
  // Imported, by its test.
} else if (mode === 'record') {
  const dirs = fs.readFileSync(DIRS, 'utf8').split(/\r?\n/).filter(Boolean);
  const links = record('.', dirs);
  fs.writeFileSync(LINKS, links.map((link) => link.join('\t')).join('\n'));
  for (const [location] of links) {
    console.log(location);
  }
} else if (mode === 'make') {
  const links = fs
    .readFileSync(LINKS, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split('\t'));
  console.log(`${links.length} links into the repository, ${make('.', links)} of them made.`);
} else {
  console.error('Usage: workspace-links.ts record|make');
  process.exit(2);
}
