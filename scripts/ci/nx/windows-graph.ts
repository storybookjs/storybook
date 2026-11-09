// Nx's project graph as a Windows job sees it, worked out on Linux, so that task-hashes.ts can hash
// the Windows tasks in CircleCI's setup job.
//
// Nx names an npm package `npm:<name>` when it counts as the hoisted one, and `npm:<name>@<version>`
// otherwise (nx/src/plugins/js/lock-file/yarn-parser.ts): a package with one version always counts
// as hoisted, one with several by the version that node_modules holds. Each OS holds other native
// packages: `supportedArchitectures` in .yarnrc.yml installs the glibc ones only on Linux and the
// win32 ones only on Windows, and prune-other-platforms.cjs then removes every package for another
// OS or CPU, on both (circleci-node-modules.sh). For a native package with several versions the
// names then differ, and with them every task's hash (`AllExternalDependencies`).
//
// So each such package is named here as on Windows: a win32 x64 one hoisted at the version the
// install hoisted (node_modules/.yarn-state.yml, written before the prune), and for one this OS
// never installs, at the version the other platforms' packages of its family hoisted (the bindings
// of one rolldown or next release, …), as Windows does. A package the Windows tree does not hold has
// no hoisted version.
import { existsSync, readFileSync } from 'node:fs';

import type { ProjectGraph } from 'nx/src/config/project-graph.js';
import { join } from 'pathe';

export type Platform = { os: string; cpu: string; libc: string | null };

export const WINDOWS: Platform = { os: 'win32', cpu: 'x64', libc: null };

export type Architectures = Partial<Record<'os' | 'cpu' | 'libc', string[]>>;

// What the Windows jobs' node_modules holds: only the current OS and CPU, whatever .yarnrc.yml
// installs, since the prune removes the rest.
export const PRUNED: Architectures = {};

// What yarn installs on `platform`: `current` is the platform's own value, and a key yarn is not
// told about means the current value only (no libc outside Linux).
export function supported(architectures: Architectures, platform: Platform) {
  return Object.fromEntries(
    (['os', 'cpu', 'libc'] as const).map((key) => [
      key,
      new Set(
        (architectures[key] ?? ['current'])
          .map((value) => (value === 'current' ? platform[key] : value))
          .filter((value): value is string => value !== null)
      ),
    ])
  ) as Record<'os' | 'cpu' | 'libc', Set<string>>;
}

// yarn.lock's `conditions: os=win32 & cpu=x64`, for each `name@version` that has some.
export function lockfileConditions(lockfile: string) {
  const conditions = new Map<string, string>();
  for (const entry of lockfile.split(/\n\n/)) {
    const resolution = /^ {2}resolution: "(.+?)@npm:([^"]+)"$/m.exec(entry);
    const condition = /^ {2}conditions: (.+)$/m.exec(entry);
    if (resolution && condition) {
      conditions.set(`${resolution[1]}@${resolution[2]}`, condition[1]);
    }
  }
  return conditions;
}

// The version of each package at the root of node_modules, from the install's .yarn-state.yml.
export function hoistedVersions(yarnState: string) {
  const hoisted = new Map<string, string>();
  for (const entry of yarnState.split(/\n\n/)) {
    const locator =
      /^"((?:@[^/@]+\/)?[^@"]+)@(?:npm:([^"]+)|patch:[^"]*?npm%3A([^#"]+)#[^"]*)":$/m.exec(entry);
    if (locator && entry.includes(`    - "node_modules/${locator[1]}"`)) {
      hoisted.set(locator[1], locator[2] ?? locator[3]);
    }
  }
  return hoisted;
}

export const installs = (condition: string, set: ReturnType<typeof supported>) =>
  condition.split('&').every((clause) => {
    const [key, value] = clause.trim().split('=') as ['os' | 'cpu' | 'libc', string];
    return set[key]?.has(value) ?? true;
  });

// `@rolldown/binding-win32-x64-msvc` and `@rolldown/binding-darwin-arm64` are one family.
const PLATFORM =
  /(^|-)(win32|linux|linuxmusl|darwin|freebsd|openbsd|netbsd|android|openharmony|sunos|aix|wasm32)(-.*)?$/;
const familyOf = (name: string) => {
  const slash = name.lastIndexOf('/');
  return name.slice(0, slash + 1) + name.slice(slash + 1).replace(PLATFORM, '');
};

type Node = { name: string; data: { packageName: string; version: string } };

// The renames that turn the external nodes Nx made here into the ones it makes on Windows.
export function renamesFor(
  externalNodes: Record<string, Node>,
  conditions: Map<string, string>,
  hoisted: Map<string, string>,
  architectures: Architectures
) {
  const windows = supported(architectures, WINDOWS);
  const byPackage = new Map<string, Node[]>();
  for (const node of Object.values(externalNodes)) {
    byPackage.set(node.data.packageName, [...(byPackage.get(node.data.packageName) ?? []), node]);
  }
  const conditionOf = (pkg: string) =>
    byPackage
      .get(pkg)
      ?.map((node) => conditions.get(`${pkg}@${node.data.version}`))
      .find(Boolean);
  // The versions each family of native packages hoisted here.
  const families = new Map<string, Set<string>>();
  for (const pkg of byPackage.keys()) {
    const version = hoisted.get(pkg);
    if (version && conditionOf(pkg)) {
      const family = familyOf(pkg);
      families.set(family, (families.get(family) ?? new Set()).add(version));
    }
  }
  const familyVersion = (pkg: string) => {
    const versions = families.get(familyOf(pkg));
    if (versions?.size === 1) {
      return [...versions][0];
    }
    if (versions && versions.size > 1) {
      console.warn(
        `The ${familyOf(pkg)}* packages hoisted ${[...versions].join(', ')}, so ${pkg} is hashed for Windows as if no version were hoisted.`
      );
    }
    return undefined;
  };
  const renames = new Map<string, string>();
  for (const [pkg, nodes] of byPackage) {
    const condition = conditionOf(pkg);
    if (!condition || nodes.length < 2) {
      continue;
    }
    const version = installs(condition, windows)
      ? (hoisted.get(pkg) ?? familyVersion(pkg))
      : undefined;
    const current = externalNodes[`npm:${pkg}`];
    if (current?.data.version === version) {
      continue;
    }
    if (current) {
      renames.set(current.name, `npm:${pkg}@${current.data.version}`);
    }
    if (version && externalNodes[`npm:${pkg}@${version}`]) {
      renames.set(`npm:${pkg}@${version}`, `npm:${pkg}`);
    }
  }
  return renames;
}

export function renameExternalNodes(
  graph: ProjectGraph,
  renames: Map<string, string>
): ProjectGraph {
  const rename = (name: string) => renames.get(name) ?? name;
  return {
    ...graph,
    externalNodes: Object.fromEntries(
      Object.entries(graph.externalNodes ?? {}).map(([name, node]) => [
        rename(name),
        { ...node, name: rename(name) as typeof node.name },
      ])
    ),
    dependencies: Object.fromEntries(
      Object.entries(graph.dependencies).map(([source, dependencies]) => [
        rename(source),
        dependencies.map((dependency) => ({
          ...dependency,
          source: rename(dependency.source),
          target: rename(dependency.target),
        })),
      ])
    ),
  };
}

export function windowsGraph(graph: ProjectGraph, root: string) {
  const state = join(root, 'node_modules/.yarn-state.yml');
  if (!existsSync(state)) {
    console.warn(`No ${state}: the Windows tasks are hashed with this OS's npm packages.`);
    return graph;
  }
  return renameExternalNodes(
    graph,
    renamesFor(
      graph.externalNodes as unknown as Record<string, Node>,
      lockfileConditions(readFileSync(join(root, 'yarn.lock'), 'utf8')),
      hoistedVersions(readFileSync(state, 'utf8')),
      PRUNED
    )
  );
}
