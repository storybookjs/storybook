// The manifests in `code/` keep the `workspace:` ranges that publishing replaces, and pnpm reports
// a `workspace:` peer range as unmet. The packages release in lockstep, so a package's own version
// is its peers' version. `workspace:` dependencies are left alone, so pnpm fails on one that lacks
// a `file:` override.
/** @param {{ version: string; peerDependencies?: Record<string, string> }} pkg */
function readPackage(pkg) {
  const peers = pkg.peerDependencies ?? {};
  for (const [name, range] of Object.entries(peers)) {
    if (typeof range === 'string' && range.startsWith('workspace:')) {
      const spec = range.slice('workspace:'.length);
      peers[name] =
        spec === '*' ? pkg.version : spec === '^' || spec === '~' ? spec + pkg.version : spec;
    }
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
