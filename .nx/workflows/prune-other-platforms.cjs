// Run by the "Install Node Modules" step in .nx/workflows/agents.yaml, after a fresh install and
// before the workers cache node_modules. .yarnrc.yml installs every platform's binaries
// (supportedArchitectures): on a Linux x64 worker, about 2 GB that it never loads.
//
// Removes packages built for another os or cpu than this machine, as Yarn skips them when
// supportedArchitectures is `current`. Yarn already skips the other libc (its default). DRY=1 only
// reports. Changing this file changes the workers' cache key.
const fs = require('fs');
const path = require('path');
const fits = (list, value) =>
  !Array.isArray(list) ||
  value === undefined ||
  (list.some((v) => !v.startsWith('!')) ? list.includes(value) : !list.includes(`!${value}`));
let count = 0;
let bytes = 0;
const size = (p) => {
  const s = fs.lstatSync(p);
  return s.isDirectory()
    ? fs.readdirSync(p).reduce((n, f) => n + size(path.join(p, f)), 0)
    : s.size;
};
const visit = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const pkgDir = path.join(dir, name);
    if (name.startsWith('@')) {
      visit(pkgDir);
      continue;
    }
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
    if (fits(pkg.os, process.platform) && fits(pkg.cpu, process.arch)) continue;
    count++;
    bytes += size(pkgDir);
    if (!process.env.DRY) fs.rmSync(pkgDir, { recursive: true, force: true });
  }
};
for (const dir of fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean)) visit(dir);
console.log(`Removed ${count} packages for other platforms (${Math.round(bytes / 1e6)} MB).`);
