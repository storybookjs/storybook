import { readFile } from 'node:fs/promises';

import { basename, dirname, isAbsolute, join, normalize } from 'pathe';
import { type FSWatcher, type Plugin, type ResolvedConfig, isFileLoadingAllowed } from 'vite';

const VERSION_QUERY = /^v=\w+$/;

// The unscoped packages of this repository whose prebuilt files the preview loads.
const UNSCOPED_STORYBOOK_PACKAGES = new Set([
  'storybook',
  'storybook-addon-pseudo-states',
  'vite-plugin-storybook-nextjs',
]);

export function isStorybookPackageName(name: unknown) {
  return (
    typeof name === 'string' &&
    (name.startsWith('@storybook/') || UNSCOPED_STORYBOOK_PACKAGES.has(name))
  );
}

export function getDistFileCandidate(id: string) {
  const queryStart = id.indexOf('?');
  const query = queryStart === -1 ? undefined : id.slice(queryStart + 1);
  const file = normalize(queryStart === -1 ? id : id.slice(0, queryStart));

  if (
    (query !== undefined && !VERSION_QUERY.test(query)) ||
    !isAbsolute(file) ||
    !file.endsWith('.js')
  ) {
    return undefined;
  }

  const packageRoots: string[] = [];
  for (let dir = dirname(file); dirname(dir) !== dir; dir = dirname(dir)) {
    if (basename(dir) === 'dist') {
      packageRoots.push(dirname(dir));
    }
  }

  return packageRoots.length > 0 ? { file, packageRoots } : undefined;
}

// Vite's dev server generates a sourcemap on every request for a JavaScript module that has none,
// unless its map has empty mappings. For Storybook's prebuilt files, which ship no sourcemaps, that
// map only describes the file in terms of itself. The empty map has to be set in `load`: Vite
// ignores a map returned by `transform` when no plugin changes the code.
export function storybookDistSourcemapsPlugin(): Plugin {
  const packageRootChecks = new Map<string, Promise<boolean>>();
  let config: ResolvedConfig;
  let watcher: FSWatcher;

  const isStorybookPackageRoot = (root: string) => {
    let check = packageRootChecks.get(root);
    if (!check) {
      check = readFile(join(root, 'package.json'), 'utf-8')
        .then((packageJson) => isStorybookPackageName(JSON.parse(packageJson).name))
        .catch(() => false);
      packageRootChecks.set(root, check);
    }
    return check;
  };

  return {
    name: 'storybook:dist-sourcemaps',
    apply: 'serve',
    // Only modules served to the browser get a generated sourcemap.
    applyToEnvironment: (environment) => environment.config.consumer === 'client',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    configureServer(server) {
      watcher = server.watcher;
    },
    load: {
      // Last, so a loader that replaces one of these files, such as an `sb.mock` redirect, wins.
      order: 'post',
      async handler(id) {
        const candidate = getDistFileCandidate(id);
        if (!candidate) {
          return null;
        }

        const { file, packageRoots } = candidate;
        const storybookRoots = await Promise.all(packageRoots.map(isStorybookPackageRoot));
        if (!storybookRoots.includes(true) || !isFileLoadingAllowed(config, file)) {
          return null;
        }

        // Vite's own loader reports an unreadable file and reads the sourcemap a file links to.
        const code = await readFile(file, 'utf-8').catch(() => null);
        if (code === null || code.includes('sourceMappingURL=')) {
          return null;
        }

        // Vite's own loader watches a file it loads from outside the root, such as a linked package.
        if (!file.startsWith(`${config.root}/`)) {
          watcher.add(file);
        }

        return { code, map: { mappings: '' } };
      },
    },
  };
}
