import { gunzipSync } from 'node:zlib';

import { SEMVER } from './cycle.ts';
import type { CatalogEntry } from './schema.ts';

// A run upgrades to a release on npm, or with `build` to the build that pkg.pr.new holds of one
// commit of storybookjs/storybook. A build carries the version of the monorepo at that commit, which
// is usually the last prerelease, so only `build` tells the two apart.
export interface Target {
  version: string;
  build?: string | undefined;
}

export const BUILD_COMMIT = /^[0-9a-f]{40}$/;

export const buildUrl = (commit: string): string => `https://pkg.pr.new/storybook@${commit}`;

const RELEASE_CLI: Record<CatalogEntry['packageManager'], (version: string) => string> = {
  npm: (version) => `npx storybook@${version}`,
  pnpm: (version) => `pnpm dlx storybook@${version}`,
  yarn: (version) => `yarn dlx storybook@${version}`,
  bun: (version) => `bunx storybook@${version}`,
};

// The upgrade reads the pkg.pr.new address from the command line that started it and writes the
// address of each Storybook package of the build into package.json, so the CLI of a build runs
// through npx whatever the project's package manager is.
export const upgradeTarget = (
  { version, build }: Target,
  packageManager: CatalogEntry['packageManager']
) => {
  if (!build) {
    return {
      cli: RELEASE_CLI[packageManager](version),
      npxCli: `npx storybook@${version}`,
      title: version,
      upgradeNote: '',
      guideRef: `v${version}`,
      cycleName: version,
    };
  }
  const cli = `npx --yes --allow-remote=all ${buildUrl(build)}`;
  return {
    cli,
    npxCli: cli,
    title: `${version} (the build of storybookjs/storybook commit ${build})`,
    upgradeNote:
      ' In each changed `package.json` the Storybook packages name an address on pkg.pr.new in place of a version range: that is how a build installs, and no finding.',
    guideRef: build,
    cycleName: `${version}-build-${build.slice(0, 10)}`,
  };
};

const NO_BUILD =
  'pkg.pr.new holds a build of every push to next, and of every push to a pull request of storybookjs/storybook that a maintainer labelled ci:canary.';

const tarEntry = (tar: Buffer, wanted: string): Buffer | undefined => {
  const field = (header: Buffer, start: number, end: number) =>
    header.toString('latin1', start, end).replace(/\0.*$/s, '').trim();
  for (let at = 0; at + 512 <= tar.length;) {
    const header = tar.subarray(at, at + 512);
    const name = field(header, 0, 100);
    if (!name) {
      return undefined;
    }
    const size = Number.parseInt(field(header, 124, 136), 8);
    const body = at + 512;
    if (name === wanted) {
      return tar.subarray(body, body + size);
    }
    at = body + Math.ceil(size / 512) * 512;
  }
  return undefined;
};

// Read the version that the build of `commit` installs, from the package.json in its tarball, or
// the one line that says why there is none.
export const buildVersion = async (
  commit: string,
  load: (url: string) => Promise<Response> = fetch
): Promise<{ version: string } | { refusal: string }> => {
  if (!BUILD_COMMIT.test(commit)) {
    return {
      refusal: `--build takes the full 40-character SHA of a commit of storybookjs/storybook, found "${commit}".`,
    };
  }
  const url = buildUrl(commit);
  const response = await load(url);
  if (response.status === 404) {
    return { refusal: `${url} does not exist. ${NO_BUILD}` };
  }
  if (!response.ok) {
    return { refusal: `${url} answered HTTP ${response.status}.` };
  }
  const manifest = tarEntry(
    gunzipSync(Buffer.from(await response.arrayBuffer())),
    'package/package.json'
  );
  const version: unknown = manifest ? JSON.parse(manifest.toString('utf8')).version : undefined;
  return typeof version === 'string' && SEMVER.test(version)
    ? { version }
    : { refusal: `${url} holds no package.json with a Storybook version.` };
};
