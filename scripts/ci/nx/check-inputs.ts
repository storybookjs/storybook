// The inputs of each package's `check` (scripts/check/check-package.ts): its own files and its
// dependencies' production files (`default` and `^production`, nx.json), and the other workspace
// files its TypeScript program loads, as `tsc --listFilesOnly` lists them, such as the renderer
// that core's types import. The packages checked by another tool (vue-tsc, svelte-check) keep
// their own inputs.
//
// Usage: check-inputs.ts, which writes them into the packages' project.json files.
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { availableParallelism } from 'node:os';
import { promisify } from 'node:util';

import { minimatch } from 'minimatch';
import { dirname, join, relative } from 'pathe';

import { esMain } from '../../utils/esmain.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CODE = join(ROOT, 'code');
const TESTS = '.{test,spec,stories}.?(c|m)[jt]s?(x)?(.snap)';
const BASE_INPUTS = ['default', '^production'];

const nxJson = JSON.parse(readFileSync(join(ROOT, 'nx.json'), 'utf8'));
const tsc = join(
  dirname(createRequire(import.meta.url).resolve('typescript-native/package.json')),
  'bin',
  'tsc'
);

type Package = {
  root: string;
  name: string;
  file: string;
  project: {
    targets: Record<string, Record<string, any>>;
    namedInputs?: Record<string, unknown[]>;
  };
  dependencies: string[];
};

const packages: Package[] = ['', 'addons', 'builders', 'frameworks', 'lib', 'presets', 'renderers']
  .flatMap((group) =>
    readdirSync(join(CODE, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(CODE, group, entry.name))
  )
  .filter((dir) => existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'project.json')))
  .map((dir) => {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    return {
      root: relative(ROOT, dir),
      name: pkg.name,
      file: join(dir, 'project.json'),
      project: JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8')),
      // The manifest fields Nx draws a project's dependencies from.
      dependencies: Object.keys({
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
        ...pkg.optionalDependencies,
      }),
    };
  });
const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));

// The packages whose `check` runs check-package.ts.
export const checkedPackages = packages.filter(
  ({ root, project }) =>
    existsSync(join(ROOT, root, 'tsconfig.json')) &&
    project.targets.check &&
    !project.targets.check.command &&
    !project.targets.check.options?.command
);

const globsOf = (inputs: unknown[], pkg: Package): string[] => {
  const named: Record<string, unknown[]> = { ...nxJson.namedInputs, ...pkg.project.namedInputs };
  return inputs.flatMap((input) => {
    if (typeof input !== 'string') {
      return [];
    }
    if (named[input]) {
      return globsOf(named[input], pkg);
    }
    return [input.replace('{workspaceRoot}/', '').replace('{projectRoot}', pkg.root)];
  });
};

const covers = (globs: string[], path: string) => {
  const matches = (glob: string) => minimatch(path, glob, { dot: true });
  return (
    globs.some((glob) => !glob.startsWith('!') && matches(glob)) &&
    !globs.some((glob) => glob.startsWith('!') && matches(glob.slice(1)))
  );
};

const dependenciesOf = (pkg: Package) => {
  const reached = new Set<Package>();
  const visit = (name: string) => {
    const dependency = byName.get(name);
    if (dependency && !reached.has(dependency)) {
      reached.add(dependency);
      dependency.dependencies.forEach(visit);
    }
  };
  pkg.dependencies.forEach(visit);
  reached.delete(pkg);
  return [...reached];
};

// Whether `check` with these inputs hashes the file: as one of the package's own inputs, or as an
// input (`^…`) of a package it depends on, directly or not.
export function hashes(pkg: Package, file: string, inputs: string[] = checkInputsOf(pkg)) {
  const own = inputs.filter((input) => !input.startsWith('^'));
  const ofDependencies = inputs.filter((input) => input.startsWith('^')).map((i) => i.slice(1));
  return (
    covers(globsOf(own, pkg), file) ||
    dependenciesOf(pkg).some((dependency) => covers(globsOf(ofDependencies, dependency), file))
  );
}

const checkInputsOf = (pkg: Package): string[] =>
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

// Runs `fn` for every item, at most as many at a time as the machine has cores.
export async function inParallel<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: availableParallelism() }, worker));
  return results;
}

const ownerOf = (file: string) =>
  packages
    .filter((pkg) => file.startsWith(`${pkg.root}/`))
    .sort((a, b) => b.root.length - a.root.length)[0];

// The inputs that hash the loaded files `default` and `^production` miss: another package's `src`
// without its tests and stories, or the file itself.
export function checkInputs(pkg: Package, files: string[]): string[] {
  const sources = new Set<string>();
  const single: string[] = [];
  for (const file of files.filter((loaded) => !hashes(pkg, loaded, BASE_INPUTS))) {
    const owner = ownerOf(file);
    if (owner && minimatch(file, `${owner.root}/src/**/*`) && !minimatch(file, `**/*${TESTS}`)) {
      sources.add(owner.root);
    } else {
      single.push(file);
    }
  }
  const extra = [
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
  const inputs = await inParallel(checkedPackages, async (pkg) =>
    checkInputs(pkg, await loadedFiles(pkg))
  );
  checkedPackages.forEach((pkg, i) => {
    const { inputs: _, ...check } = pkg.project.targets.check;
    pkg.project.targets.check = inputs[i].length > 0 ? { ...check, inputs: inputs[i] } : check;
    writeFileSync(pkg.file, `${JSON.stringify(pkg.project, null, 2)}\n`);
  });
}
