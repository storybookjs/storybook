import { existsSync, readFileSync } from 'node:fs';

import { dirname, join, normalize } from 'pathe';
import type { Plugin } from 'rolldown';

interface Manifest {
  dir: string;
  name?: string;
  main?: string;
  module?: string;
  browser?: unknown;
  exports?: unknown;
}

// A directory of a package may hold a `package.json` that only sets `type`.
const findManifest = (file: string): Manifest | undefined => {
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    const path = join(dir, 'package.json');
    if (existsSync(path)) {
      const manifest: Manifest = { ...JSON.parse(readFileSync(path, 'utf8')), dir };
      if (manifest.name) {
        return manifest;
      }
    }
  }
  return undefined;
};

// Rolldown gives `require()` of a package the ES module that its `module` field names, which is
// an object with a `default` property. Published addons expect the file of `main`, and expect
// every `import` of the package to get that file as well, so that a bundle holds the package once.
//
// `required` receives the ES module of each package that got its `main` file, by the directory
// of the package. An `import` of a package in `everywhere` gets the `main` file too.
export const requireMain = (
  required: Map<string, string>,
  everywhere: ReadonlySet<string>
): Plugin => ({
  name: 'storybook:manager-require-main',
  resolveId: {
    filter: { id: /^[^./\0]/ },
    async handler(source, importer, { kind }) {
      const isRequire = kind === 'require-call';
      if (!isRequire && everywhere.size === 0) {
        return null;
      }
      const resolved = await this.resolve(source, importer, { kind, skipSelf: true });
      const manifest = resolved && !resolved.external && findManifest(resolved.id);
      if (
        !manifest ||
        !manifest.main ||
        !manifest.module ||
        manifest.exports ||
        typeof manifest.browser === 'string' ||
        normalize(resolved.id) !== join(manifest.dir, manifest.module) ||
        !(isRequire || everywhere.has(manifest.dir))
      ) {
        return resolved;
      }
      required.set(manifest.dir, normalize(resolved.id));
      return this.resolve(`./${manifest.main}`, join(manifest.dir, 'package.json'), {
        kind,
        skipSelf: true,
      });
    },
  },
});
