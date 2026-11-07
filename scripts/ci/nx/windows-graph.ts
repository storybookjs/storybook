// Nx's project graph as a Windows job sees it, worked out on Linux, so that task-hashes.ts can hash
// the Windows tasks in CircleCI's setup job.
//
// Nx names an npm package `npm:<name>` when it counts as the hoisted one, and `npm:<name>@<version>`
// otherwise (nx/src/plugins/js/lock-file/yarn-parser.ts): a package with one version always counts
// as hoisted, one with several by the version that node_modules holds. `supportedArchitectures` in
// .yarnrc.yml installs other native packages on each OS (the glibc ones only on Linux, the win32 ones
// only on Windows), so for a native package with several versions the names differ, and with them
// every task's hash (`AllExternalDependencies`). Windows hoists the version that the other
// platforms' packages of its family hoist (the bindings of one rolldown or next release, …), so the
// version comes from a member of the family that is installed here.
import { readFileSync } from 'node:fs';

import type { ProjectGraph } from 'nx/src/config/project-graph.js';
import { join } from 'pathe';
import { parse } from 'yaml';

export type Platform = { os: string; cpu: string; libc: string | null };

export const WINDOWS: Platform = { os: 'win32', cpu: 'x64', libc: null };

// As yarn decides it: libc only on Linux.
export const currentPlatform = (): Platform => ({
  os: process.platform,
  cpu: process.arch,
  libc:
    process.platform === 'linux'
      ? (process.report?.getReport() as { header?: { glibcVersionRuntime?: string } }).header
          ?.glibcVersionRuntime
        ? 'glibc'
        : 'musl'
      : null,
});

type Architectures = Partial<Record<'os' | 'cpu' | 'libc', string[]>>;

// What yarn installs on `platform`: `current` is the platform's own value, and a key yarn is not
// told about means the current value only.
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

export const installs = (condition: string, set: ReturnType<typeof supported>) =>
  condition.split('&').every((clause) => {
    const [key, value] = clause.trim().split('=') as ['os' | 'cpu' | 'libc', string];
    return set[key]?.has(value) ?? true;
  });

// `@rolldown/binding-win32-x64-msvc` and `@rolldown/binding-darwin-arm64` are one family.
const PLATFORM =
  /(^|-)(win32|linux|darwin|freebsd|openbsd|netbsd|android|openharmony|sunos|aix|wasm32)(-.*)?$/;
const familyOf = (name: string) => {
  const slash = name.lastIndexOf('/');
  return name.slice(0, slash + 1) + name.slice(slash + 1).replace(PLATFORM, '');
};

type Node = { name: string; data: { packageName: string; version: string } };

// The renames that turn the external nodes Nx made on `from` into the ones it makes on `to`.
export function renamesFor(
  externalNodes: Record<string, Node>,
  conditions: Map<string, string>,
  architectures: Architectures,
  from: Platform,
  to: Platform
) {
  const fromSet = supported(architectures, from);
  const toSet = supported(architectures, to);
  const byPackage = new Map<string, Node[]>();
  for (const node of Object.values(externalNodes)) {
    byPackage.set(node.data.packageName, [...(byPackage.get(node.data.packageName) ?? []), node]);
  }
  const conditionOf = (pkg: string) =>
    byPackage
      .get(pkg)
      ?.map((node) => conditions.get(`${pkg}@${node.data.version}`))
      .find(Boolean);
  // The hoisted version of each family here, from its members installed here.
  const hoisted = new Map<string, string>();
  for (const [pkg, nodes] of byPackage) {
    const condition = conditionOf(pkg);
    const node = externalNodes[`npm:${pkg}`];
    if (condition && nodes.length > 1 && node && installs(condition, fromSet)) {
      hoisted.set(familyOf(pkg), node.data.version);
    }
  }
  const renames = new Map<string, string>();
  for (const [pkg, nodes] of byPackage) {
    const condition = conditionOf(pkg);
    if (!condition || nodes.length < 2) {
      continue;
    }
    const here = installs(condition, fromSet);
    const there = installs(condition, toSet);
    const node = externalNodes[`npm:${pkg}`];
    if (here && !there && node) {
      renames.set(node.name, `npm:${pkg}@${node.data.version}`);
    }
    const version = hoisted.get(familyOf(pkg));
    if (!here && there && !node && version && externalNodes[`npm:${pkg}@${version}`]) {
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
  const architectures =
    (
      parse(readFileSync(join(root, '.yarnrc.yml'), 'utf8')) as {
        supportedArchitectures?: Architectures;
      }
    ).supportedArchitectures ?? {};
  const renames = renamesFor(
    graph.externalNodes as unknown as Record<string, Node>,
    lockfileConditions(readFileSync(join(root, 'yarn.lock'), 'utf8')),
    architectures,
    currentPlatform(),
    WINDOWS
  );
  return renameExternalNodes(graph, renames);
}
