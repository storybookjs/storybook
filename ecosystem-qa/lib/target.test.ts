import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { cycleBranchName } from './cycle.ts';
import { buildUrl, buildVersion, upgradeTarget } from './target.ts';

const COMMIT = '3435e27065c0fd8e123c0251783882de4db00c1f';

const scratch = mkdtempSync(join(tmpdir(), 'ecosystem-qa-target-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

// A tarball as npm packs it, made by the system tar, with a file before the manifest.
const packed = (manifest: object): Buffer => {
  const dir = mkdtempSync(join(scratch, 'pack-'));
  mkdirSync(join(dir, 'package/dist'), { recursive: true });
  writeFileSync(join(dir, 'package/dist/index.js'), 'x'.repeat(1300));
  writeFileSync(join(dir, 'package/package.json'), JSON.stringify(manifest));
  execFileSync('tar', ['-czf', 'build.tgz', 'package/dist/index.js', 'package/package.json'], {
    cwd: dir,
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  });
  return readFileSync(join(dir, 'build.tgz'));
};

const answering = (status: number, body: Buffer | null = null) =>
  vi.fn(async (_url: string) => new Response(body, { status }));

describe('buildVersion', () => {
  it('reads the version from the package.json in the tarball of the build', async () => {
    const load = answering(200, packed({ name: 'storybook', version: '11.0.0-beta.3' }));

    await expect(buildVersion(COMMIT, load)).resolves.toEqual({ version: '11.0.0-beta.3' });
    expect(load).toHaveBeenCalledWith(`https://pkg.pr.new/storybook@${COMMIT}`);
  });

  it('refuses a build that pkg.pr.new does not have and says how one comes to exist', async () => {
    const found = await buildVersion(COMMIT, answering(404));

    expect(found).toEqual({
      refusal: expect.stringMatching(
        /^https:\/\/pkg\.pr\.new\/storybook@3435e27\S+ does not exist\. .*every push to next.*labelled ci:canary\.$/
      ),
    });
  });

  it.each(['3435e27', 'main', `${COMMIT} `])(
    'refuses %j before it asks pkg.pr.new, because only a full SHA names one commit',
    async (commit) => {
      const load = answering(200);

      await expect(buildVersion(commit, load)).resolves.toEqual({
        refusal: expect.stringContaining('full 40-character SHA'),
      });
      expect(load).not.toHaveBeenCalled();
    }
  );

  it('refuses a tarball whose package.json carries no Storybook version', async () => {
    await expect(
      buildVersion(COMMIT, answering(200, packed({ name: 'storybook', version: 'next' })))
    ).resolves.toEqual({
      refusal: `${buildUrl(COMMIT)} holds no package.json with a Storybook version.`,
    });
  });
});

describe('upgradeTarget of a build', () => {
  it.each(['npm', 'pnpm', 'yarn', 'bun'] as const)(
    'runs the CLI of the build with %s, never the release of the same version',
    (packageManager) => {
      const target = upgradeTarget({ version: '11.0.0-beta.3', build: COMMIT }, packageManager);

      expect(target.cli).toBe(`npx --yes --allow-remote=all ${buildUrl(COMMIT)}`);
      expect(target.npxCli).toBe(target.cli);
      expect(`${target.title}${target.upgradeNote}`).toContain(COMMIT);
    }
  );

  it('reads the migration guide at the commit and keeps its cycle apart from the release', () => {
    const release = upgradeTarget({ version: '11.0.0-beta.3' }, 'npm');
    const build = upgradeTarget({ version: '11.0.0-beta.3', build: COMMIT }, 'npm');

    expect(build.guideRef).toBe(COMMIT);
    expect(cycleBranchName(build.cycleName, 'linux', 'claude')).not.toBe(
      cycleBranchName(release.cycleName, 'linux', 'claude')
    );
  });
});
