/**
 * A pnpm hook for projects that install the Storybook packages from this monorepo's `code/`
 * directory with `file:` overrides: linked sandboxes and the test-storybooks.
 *
 * Their manifests still carry the `workspace:` ranges that `pnpm pack` replaces when publishing.
 * pnpm reports a `workspace:^` peer range as unmet, so rewrite peer ranges the way publishing
 * does. `workspace:` dependencies are left alone on purpose: each must be overridden to its
 * `code/` directory too, and pnpm fails loudly when one is not, instead of quietly installing the
 * published package.
 *
 * The packages are released in lockstep, so a package's own version is the version of every
 * workspace package it peers on.
 *
 * @param {{ version: string; peerDependencies?: Record<string, string> }} pkg
 */
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
