import { describe, expect, it } from 'vitest';

import type { ProjectGraph } from 'nx/src/config/project-graph.js';

import {
  type Platform,
  WINDOWS,
  hoistedVersions,
  installs,
  lockfileConditions,
  renameExternalNodes,
  renamesFor,
  supported,
} from './windows-graph.ts';

const LINUX: Platform = { os: 'linux', cpu: 'x64', libc: 'glibc' };
// As .yarnrc.yml has it.
const ARCHITECTURES = { os: ['current', 'linux', 'darwin'], cpu: ['current', 'x64', 'arm64'] };

const node = (pkg: string, version: string, hoisted = false) => {
  const name = hoisted ? `npm:${pkg}` : `npm:${pkg}@${version}`;
  return [name, { name, data: { packageName: pkg, version } }] as const;
};

const PACKAGES = [
  ['@rolldown/binding-win32-x64-msvc', 'os=win32 & cpu=x64'],
  ['@rolldown/binding-darwin-arm64', 'os=darwin & cpu=arm64'],
  ['@rolldown/binding-linux-x64-gnu', 'os=linux & cpu=x64 & libc=glibc'],
  ['fsevents', 'os=darwin'],
];
const LOCKFILE = PACKAGES.flatMap(([pkg, condition]) =>
  ['1.0.0', '1.1.0'].map(
    (version) =>
      `"${pkg}@npm:${version}":\n  version: ${version}\n  resolution: "${pkg}@npm:${version}"\n  conditions: ${condition}\n  languageName: node\n  linkType: hard`
  )
).join('\n\n');

// What a Linux install hoisted, before prune-other-platforms.cjs removed the darwin packages.
const YARN_STATE = [
  '__metadata:\n  version: 1\n  nmMode: classic',
  '"@rolldown/binding-darwin-arm64@npm:1.0.0":\n  locations:\n    - "node_modules/@rolldown/binding-darwin-arm64"',
  '"@rolldown/binding-darwin-arm64@npm:1.1.0":\n  locations:\n    - "node_modules/rolldown/node_modules/@rolldown/binding-darwin-arm64"',
  '"@rolldown/binding-linux-x64-gnu@npm:1.0.0":\n  locations:\n    - "node_modules/@rolldown/binding-linux-x64-gnu"',
  '"fsevents@patch:fsevents@npm%3A1.1.0#optional!builtin<compat/fsevents>":\n  locations:\n    - "node_modules/fsevents"',
  '"semver@npm:7.0.0":\n  locations:\n    - "node_modules/semver"\n    - "code/node_modules/semver"',
].join('\n\n');

describe('what yarn installs on Windows', () => {
  const windows = supported(ARCHITECTURES, WINDOWS);

  it('installs the win32 and darwin packages, but no package that needs a libc', () => {
    expect(installs('os=win32 & cpu=x64', windows)).toBe(true);
    expect(installs('os=darwin & cpu=arm64', windows)).toBe(true);
    expect(installs('os=linux & cpu=x64 & libc=glibc', windows)).toBe(false);
    expect(installs('os=linux & cpu=x64 & libc=glibc', supported(ARCHITECTURES, LINUX))).toBe(true);
    expect(installs('os=win32 & cpu=x64', supported(ARCHITECTURES, LINUX))).toBe(false);
  });

  it('reads the conditions of each version from yarn.lock', () => {
    expect(lockfileConditions(LOCKFILE).get('@rolldown/binding-win32-x64-msvc@1.1.0')).toBe(
      'os=win32 & cpu=x64'
    );
  });

  it('reads the version at the root of node_modules from the install state, patched ones too', () => {
    expect(Object.fromEntries(hoistedVersions(YARN_STATE))).toEqual({
      '@rolldown/binding-darwin-arm64': '1.0.0',
      '@rolldown/binding-linux-x64-gnu': '1.0.0',
      fsevents: '1.1.0',
      semver: '7.0.0',
    });
  });
});

describe('the npm packages as Nx names them on Windows, worked out in the setup job', () => {
  // The setup job's node_modules holds the glibc bindings, but neither the win32 ones (never
  // installed) nor the darwin ones and fsevents (pruned), so Nx gives each of their versions one.
  const setupNodes = Object.fromEntries([
    node('@rolldown/binding-darwin-arm64', '1.0.0'),
    node('@rolldown/binding-darwin-arm64', '1.1.0'),
    node('@rolldown/binding-linux-x64-gnu', '1.0.0', true),
    node('@rolldown/binding-linux-x64-gnu', '1.1.0'),
    node('@rolldown/binding-win32-x64-msvc', '1.0.0'),
    node('@rolldown/binding-win32-x64-msvc', '1.1.0'),
    node('fsevents', '1.0.0'),
    node('fsevents', '1.1.0'),
    node('semver', '7.0.0', true),
    node('semver', '6.0.0'),
  ]);
  const renames = renamesFor(
    setupNodes,
    lockfileConditions(LOCKFILE),
    hoistedVersions(YARN_STATE),
    ARCHITECTURES
  );

  it('names a package Windows installs at the version the install hoisted, also when pruned since', () => {
    expect(renames.get('npm:@rolldown/binding-darwin-arm64@1.0.0')).toBe(
      'npm:@rolldown/binding-darwin-arm64'
    );
    expect(renames.get('npm:fsevents@1.1.0')).toBe('npm:fsevents');
  });

  it('names a win32 package at the version its family hoisted', () => {
    expect(renames.get('npm:@rolldown/binding-win32-x64-msvc@1.0.0')).toBe(
      'npm:@rolldown/binding-win32-x64-msvc'
    );
  });

  it('gives the glibc binding Windows does not install its version', () => {
    expect(renames.get('npm:@rolldown/binding-linux-x64-gnu')).toBe(
      'npm:@rolldown/binding-linux-x64-gnu@1.0.0'
    );
  });

  it('leaves every other package as it is', () => {
    expect([...renames.keys()].sort()).toEqual([
      'npm:@rolldown/binding-darwin-arm64@1.0.0',
      'npm:@rolldown/binding-linux-x64-gnu',
      'npm:@rolldown/binding-win32-x64-msvc@1.0.0',
      'npm:fsevents@1.1.0',
    ]);
  });

  it('renames the nodes and every dependency on them, in a new graph', () => {
    const graph = {
      nodes: {},
      externalNodes: setupNodes,
      dependencies: {
        'npm:rolldown': [
          {
            source: 'npm:rolldown',
            target: 'npm:@rolldown/binding-win32-x64-msvc@1.0.0',
            type: 'static',
          },
        ],
      },
    } as unknown as ProjectGraph;

    const windows = renameExternalNodes(graph, renames);

    expect(windows).not.toBe(graph);
    expect(windows.externalNodes?.['npm:@rolldown/binding-win32-x64-msvc']?.name).toBe(
      'npm:@rolldown/binding-win32-x64-msvc'
    );
    expect(windows.dependencies['npm:rolldown'][0].target).toBe(
      'npm:@rolldown/binding-win32-x64-msvc'
    );
    expect(graph.externalNodes?.['npm:@rolldown/binding-win32-x64-msvc@1.0.0']).toBeDefined();
  });
});
