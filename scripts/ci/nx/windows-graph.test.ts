import { describe, expect, it } from 'vitest';

import {
  type Platform,
  WINDOWS,
  installs,
  lockfileConditions,
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

const LOCKFILE = [
  ['@rolldown/binding-win32-x64-msvc', 'os=win32 & cpu=x64'],
  ['@rolldown/binding-darwin-arm64', 'os=darwin & cpu=arm64'],
  ['@rolldown/binding-linux-x64-gnu', 'os=linux & cpu=x64 & libc=glibc'],
]
  .flatMap(([pkg, condition]) =>
    ['1.0.0', '1.1.0'].map(
      (version) =>
        `"${pkg}@npm:${version}":\n  version: ${version}\n  resolution: "${pkg}@npm:${version}"\n  conditions: ${condition}\n  languageName: node\n  linkType: hard`
    )
  )
  .join('\n\n');

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
});

describe('the npm packages as Nx names them on Windows, worked out on Linux', () => {
  // On Linux, node_modules holds the darwin and glibc bindings, so Nx names their hoisted version
  // without one; the win32 bindings are not installed, so each of their versions has one.
  const linuxNodes = Object.fromEntries([
    node('@rolldown/binding-darwin-arm64', '1.0.0', true),
    node('@rolldown/binding-darwin-arm64', '1.1.0'),
    node('@rolldown/binding-linux-x64-gnu', '1.0.0', true),
    node('@rolldown/binding-linux-x64-gnu', '1.1.0'),
    node('@rolldown/binding-win32-x64-msvc', '1.0.0'),
    node('@rolldown/binding-win32-x64-msvc', '1.1.0'),
    node('semver', '7.0.0', true),
    node('semver', '6.0.0'),
  ]);
  const renames = renamesFor(
    linuxNodes,
    lockfileConditions(LOCKFILE),
    ARCHITECTURES,
    LINUX,
    WINDOWS
  );

  it('names the win32 binding Windows installs as hoisted, at the version its family hoists here', () => {
    expect(renames.get('npm:@rolldown/binding-win32-x64-msvc@1.0.0')).toBe(
      'npm:@rolldown/binding-win32-x64-msvc'
    );
    expect(renames.has('npm:@rolldown/binding-win32-x64-msvc@1.1.0')).toBe(false);
  });

  it('gives the glibc binding Windows does not install its version', () => {
    expect(renames.get('npm:@rolldown/binding-linux-x64-gnu')).toBe(
      'npm:@rolldown/binding-linux-x64-gnu@1.0.0'
    );
  });

  it('leaves the packages every OS installs alike', () => {
    expect([...renames.keys()].sort()).toEqual([
      'npm:@rolldown/binding-linux-x64-gnu',
      'npm:@rolldown/binding-win32-x64-msvc@1.0.0',
    ]);
  });
});
