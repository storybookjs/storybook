// Run by the "Install Node Modules" step in .nx/workflows/agents.yaml, after a fresh install and
// before the workers cache node_modules. .yarnrc.yml installs every platform's binaries
// (supportedArchitectures), about 1 GB that a Linux x64 worker never loads.
//
// Removes packages built for another os, cpu or libc than this machine, as Yarn skips them when
// supportedArchitectures is `current`. DRY=1 only reports.
const fs = require('fs');
const path = require('path');
const glibc = Boolean(process.report?.getReport().header.glibcVersionRuntime);
const libc = process.platform === 'linux' ? (glibc ? 'glibc' : 'musl') : undefined;
const fits = (list, value) =>
  !Array.isArray(list) || value === undefined ||
  (list.some((v) => !v.startsWith('!')) ? list.includes(value) : !list.includes(`!${value}`));
let count = 0;
let bytes = 0;
const size = (p) => {
  const s = fs.lstatSync(p);
  return s.isDirectory() ? fs.readdirSync(p).reduce((n, f) => n + size(path.join(p, f)), 0) : s.size;
};
const visit = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const pkgDir = path.join(dir, name);
    if (name.startsWith('@')) { visit(pkgDir); continue; }
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')); } catch { continue; }
    if (fits(pkg.os, process.platform) && fits(pkg.cpu, process.arch) && fits(pkg.libc, libc)) continue;
    count++;
    bytes += size(pkgDir);
    if (!process.env.DRY) fs.rmSync(pkgDir, { recursive: true, force: true });
  }
};
for (const dir of fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean)) visit(dir);
console.log(`Removed ${count} packages for other platforms (${Math.round(bytes / 1e6)} MB).`);
