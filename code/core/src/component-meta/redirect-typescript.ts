import { createRequire } from 'node:module';
import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

type ResolveFilename = (
  request: string,
  parent: { filename?: string } | undefined,
  ...rest: unknown[]
) => string;

type Redirect = {
  packageDir: string;
  entry: string;
  packageRoot: string;
};

const redirects: Redirect[] = [];
let installed = false;

/** Directory of the nearest package.json at or above a resolved file. */
export function packageRootFromFile(resolvedFile: string): string {
  let dir = dirname(realpathSync(resolvedFile));
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) {
      return dir;
    }
    dir = parent;
  }
  return dir;
}

const matchingRedirect = (parentFile: string) =>
  redirects.find((entry) => parentFile.startsWith(entry.packageDir + sep));

const parentCandidates = (parentFile: string) => {
  try {
    const real = realpathSync(parentFile);
    return real === parentFile ? [parentFile] : [parentFile, real];
  } catch {
    return [parentFile];
  }
};

const redirectedSpecifier = (specifier: string, parentFile: string | undefined) => {
  if (!parentFile || (specifier !== 'typescript' && !specifier.startsWith('typescript/'))) {
    return undefined;
  }
  const redirect = parentCandidates(parentFile)
    .map((candidate) => matchingRedirect(candidate))
    .find((entry) => entry);
  if (!redirect) {
    return undefined;
  }
  if (specifier === 'typescript') {
    return redirect.entry;
  }
  return join(redirect.packageRoot, specifier.slice('typescript/'.length));
};

const install = () => {
  if (installed) {
    return;
  }
  installed = true;

  const nodeModule = require('node:module') as {
    registerHooks?: (hooks: {
      resolve: (
        specifier: string,
        context: { parentURL?: string },
        nextResolve: (specifier: string, context?: { parentURL?: string }) => { url: string }
      ) => { url: string; shortCircuit?: boolean };
    }) => void;
  };

  // `registerHooks` covers require() and import(), and exists from Node 22.15. Storybook also
  // runs on 22.12, where only require() can be redirected.
  if (typeof nodeModule.registerHooks === 'function') {
    nodeModule.registerHooks({
      resolve(specifier, context, nextResolve) {
        const parent = context.parentURL?.startsWith('file:')
          ? fileURLToPath(context.parentURL)
          : undefined;
        const redirected = redirectedSpecifier(specifier, parent);
        if (!redirected) {
          return nextResolve(specifier, context);
        }
        return { url: pathToFileURL(redirected).href, shortCircuit: true };
      },
    });
    return;
  }

  const nodeRequire = require('module') as { _resolveFilename: ResolveFilename };
  const resolveFilename = nodeRequire._resolveFilename;
  nodeRequire._resolveFilename = function (request, parent, ...rest) {
    const redirected = redirectedSpecifier(request, parent?.filename) ?? request;
    return resolveFilename.call(this, redirected, parent, ...rest);
  };
};

/**
 * Make `typescript` loads from files inside `packageDir` resolve to `targetPath` instead.
 *
 * For libraries that load `typescript` themselves, so they can use `@typescript/typescript6` when the
 * project uses TypeScript 7. Loads from other packages are unaffected.
 */
export function redirectTypeScriptRequires(packageDir: string, targetPath: string): void {
  const resolvedDir = realpathSync(packageDir);
  if (redirects.some((entry) => entry.packageDir === resolvedDir)) {
    return;
  }
  const entry = realpathSync(targetPath);
  redirects.push({ packageDir: resolvedDir, entry, packageRoot: packageRootFromFile(entry) });
  install();
}
