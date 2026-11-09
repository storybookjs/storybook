// The inputs of each package's `check` (scripts/check/check-package.ts): its own files and its
// dependencies' own production files (`default` and `^own-production`, nx.json), and the other
// workspace files its TypeScript program loads, as `tsc --listFilesOnly` lists them, such as the
// renderer that core's types import. `check` runs after every `compile`, so the program loads the
// declarations in other packages' `dist`, which Nx does not hash: their package's `production`,
// which its `compile` builds them from, stands in for them. The packages checked by another tool
// (vue-tsc, svelte-check) keep their own inputs.
//
// Usage: check-inputs.ts, after compiling every package; it writes the inputs into the packages'
// project.json files.
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { availableParallelism } from 'node:os';
import { promisify } from 'node:util';

import { minimatch } from 'minimatch';
import { dirname, join, relative } from 'pathe';

import { esMain } from '../../utils/esmain.ts';
import {
  type Package,
  ROOT,
  covers,
  dependenciesOf,
  globsOf,
  nxJson,
  ownerOf,
  packages,
} from './inputs.ts';

const TESTS = '.{test,spec,stories}.?(c|m)[jt]s?(x)?(.snap)';
const BASE_INPUTS = ['default', '^own-production'];

const tsc = join(
  dirname(createRequire(import.meta.url).resolve('typescript-native/package.json')),
  'bin',
  'tsc'
);

type Input = string | { projects: string[]; input: string };

// The packages whose `check` runs check-package.ts.
export const checkedPackages = packages.filter(
  ({ root, project }) =>
    existsSync(join(ROOT, root, 'tsconfig.json')) &&
    project.targets.check &&
    !project.targets.check.command &&
    !project.targets.check.options?.command
);

// Whether every package that scripts/build/build-package.ts compiles has its declarations, as after
// the production compile that `check` runs after. A development compile writes no `.d.ts`.
export const compiled = packages
  .filter(({ root }) => existsSync(join(ROOT, root, 'build-config.ts')))
  .every(
    ({ root }) =>
      existsSync(join(ROOT, root, 'dist')) &&
      readdirSync(join(ROOT, root, 'dist'), { recursive: true }).some((file) =>
        String(file).endsWith('.d.ts')
      )
  );

const builtBy = (file: string) => {
  const owner = ownerOf(file);
  return owner && file.startsWith(`${owner.root}/dist/`) ? owner : undefined;
};

const productionOf = (pkg: Package): Input => ({
  projects: [pkg.project.name],
  input: 'production',
});

const isProductionOf = (input: Input, pkg: Package) =>
  typeof input !== 'string' &&
  input.input === 'production' &&
  input.projects.includes(pkg.project.name);

// Whether `check` with these inputs hashes the file: as one of the package's own inputs, as an
// input (`^…`) of a package it depends on, directly or not, or as another package's input. A file
// in another package's `dist` counts as hashed when that package's `production` is.
export function hashes(pkg: Package, file: string, inputs: Input[] = checkInputsOf(pkg)) {
  const built = builtBy(file);
  if (built) {
    return inputs.some((input) => isProductionOf(input, built));
  }
  const own = inputs.filter((input): input is string => typeof input === 'string');
  const ofDependencies = own.filter((input) => input.startsWith('^')).map((i) => i.slice(1));
  return (
    covers(globsOf(own, pkg.project.namedInputs ?? {}, pkg.root), file) ||
    dependenciesOf(pkg).some((dependency) =>
      covers(globsOf(ofDependencies, dependency.project.namedInputs ?? {}, dependency.root), file)
    ) ||
    packages.some((other) =>
      inputs.some(
        (input) =>
          typeof input !== 'string' &&
          input.projects.includes(other.project.name) &&
          covers(globsOf([input.input], other.project.namedInputs ?? {}, other.root), file)
      )
    )
  );
}

const checkInputsOf = (pkg: Package): Input[] =>
  pkg.project.targets.check.inputs ?? nxJson.targetDefaults.check.inputs;

const run = promisify(execFile);

// The workspace files the package's TypeScript programs load, outside node_modules.
export async function loadedFiles(pkg: Package): Promise<string[]> {
  const configs = ['tsconfig.json', 'tsconfig.strict.json'].filter((config) =>
    existsSync(join(ROOT, pkg.root, config))
  );
  const lists = await Promise.all(
    configs.map(
      async (config) =>
        (
          await run(process.execPath, [tsc, '--project', config, '--listFilesOnly'], {
            cwd: join(ROOT, pkg.root),
            maxBuffer: 256 * 1024 * 1024,
          })
        ).stdout
    )
  );
  const files = lists
    .flatMap((list) => list.split('\n'))
    .map((file) => file.trim())
    .filter(Boolean)
    .map((file) => relative(ROOT, file))
    .filter((file) => !file.startsWith('..') && !file.includes('node_modules/'));
  return [...new Set(files)].sort();
}

// Runs `fn` for every item, a few at a time: each is a TypeScript program of up to a few GB, and
// on CI the cores Node reports are the host's, not the container's.
export async function inParallel<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, availableParallelism()) }, worker));
  return results;
}

// The inputs that hash the loaded files `default` and `^own-production` miss: the `production` of
// a package whose `dist` it loads, another package's `src` without its tests and stories, or the
// file itself.
export function checkInputs(pkg: Package, files: string[]): Input[] {
  const unhashed = files.filter((file) => !hashes(pkg, file, BASE_INPUTS));
  const built = [...new Set(unhashed.map(builtBy).filter((owner) => owner !== undefined))].sort(
    (a, b) => a.root.localeCompare(b.root)
  );
  const withBuilt = [...BASE_INPUTS, ...built.map(productionOf)];
  const sources = new Set<string>();
  const single: string[] = [];
  for (const file of unhashed.filter((loaded) => !hashes(pkg, loaded, withBuilt))) {
    const owner = ownerOf(file);
    if (owner && minimatch(file, `${owner.root}/src/**/*`) && !minimatch(file, `**/*${TESTS}`)) {
      sources.add(owner.root);
    } else {
      single.push(file);
    }
  }
  const extra = [
    ...built.map(productionOf),
    ...[...sources]
      .sort()
      .flatMap((root) => [
        `{workspaceRoot}/${root}/src/**/*`,
        `!{workspaceRoot}/${root}/src/**/*${TESTS}`,
      ]),
    ...single.sort().map((file) => `{workspaceRoot}/${file}`),
  ];
  return extra.length > 0 ? [...BASE_INPUTS, ...extra] : [];
}

if (esMain(import.meta.url)) {
  if (!compiled) {
    throw new Error('Compile every package first: `yarn nx run-many -t compile -c production`.');
  }
  const inputs = await inParallel(checkedPackages, async (pkg) =>
    checkInputs(pkg, await loadedFiles(pkg))
  );
  checkedPackages.forEach((pkg, i) => {
    const { inputs: _, ...check } = pkg.project.targets.check;
    pkg.project.targets.check = inputs[i].length > 0 ? { ...check, inputs: inputs[i] } : check;
    writeFileSync(pkg.file, `${JSON.stringify(pkg.project, null, 2)}\n`);
  });
}
