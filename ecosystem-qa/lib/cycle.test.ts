import { describe, expect, it } from 'vitest';

import { cycleBranchName, parseBundleHeader, pushTokenEnv, versionLine } from './cycle.ts';

describe('versionLine', () => {
  it('reads major.minor from a release or prerelease', () => {
    expect(versionLine('11.0.0-beta.0')).toBe('11.0');
    expect(versionLine('11.2.3')).toBe('11.2');
  });

  it.each(['11', '11.0', 'latest', '11.0.0-beta..0', '11.0.0 '])('rejects %j', (version) => {
    expect(() => versionLine(version)).toThrow(/not a Storybook version/);
  });
});

describe('cycleBranchName', () => {
  it('gives each prerelease of a minor line its own branch', () => {
    expect(cycleBranchName('11.0.0-beta.0', 'linux', 'claude')).toBe(
      'qa/sb-11.0.0-beta.0/linux-claude'
    );
    expect(cycleBranchName('11.0.0-beta.1', 'linux', 'claude')).not.toBe(
      cycleBranchName('11.0.0-beta.0', 'linux', 'claude')
    );
  });
});

describe('parseBundleHeader', () => {
  it('reads the prerequisites and refs before the pack', () => {
    const header = parseBundleHeader(
      `# v3 git bundle\n@object-format=sha1\n-${'a'.repeat(40)} start\n${'b'.repeat(40)} refs/heads/qa\n\nPACK\n\nbinary`
    );

    expect(header.prerequisites).toEqual(['a'.repeat(40)]);
    expect([...header.refs]).toEqual([['refs/heads/qa', 'b'.repeat(40)]]);
  });

  it('rejects a file that is not a bundle', () => {
    expect(() => parseBundleHeader('{"not":"a bundle"}\n\n')).toThrow(/Not a git bundle/);
  });
});

describe('pushTokenEnv', () => {
  it('names the secret of the repo owner', () => {
    expect(pushTokenEnv('storybookjs/mealdrop')).toBe('ECOSYSTEM_QA_PUSH_TOKEN');
    expect(pushTokenEnv('storybook-tmp/twenty')).toBe('ECOSYSTEM_QA_PUSH_TOKEN_STORYBOOK_TMP');
  });

  it.each(['twentyhq/twenty', 'toString/x'])('throws for %s, whose owner has no secret', (repo) => {
    expect(() => pushTokenEnv(repo)).toThrow(/No push token is configured/);
  });
});
