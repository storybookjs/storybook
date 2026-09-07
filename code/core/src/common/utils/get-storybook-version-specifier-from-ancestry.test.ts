import { describe, expect, it } from 'vitest';

import { getStorybookVersionSpecifierFromAncestry } from './get-storybook-version-specifier-from-ancestry.ts';

describe('getStorybookVersionSpecifierFromAncestry', () => {
  it('ignores a bare storybook@ version with no leading space', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([
        { command: 'node' },
        { command: 'storybook@7.0.0' },
        { command: 'npm' },
      ])
    ).toBeUndefined();
  });

  it('extracts a version from npm create storybook@', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([
        { command: 'node' },
        { command: 'npm create storybook@7.0.0-alpha.3' },
        { command: 'npm' },
      ])
    ).toBe('7.0.0-alpha.3');
  });

  it('extracts a version from npx storybook@ init', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([{ command: 'npx storybook@7.0.0 init' }])
    ).toBe('7.0.0');
  });

  it('returns undefined when storybook has no version', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([{ command: 'npx storybook init' }])
    ).toBeUndefined();
  });

  it('extracts latest from create-storybook@latest', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([{ command: 'npx create-storybook@latest' }])
    ).toBe('latest');
  });

  it('does not match foo-storybook', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([{ command: 'npx foo-storybook@latest' }])
    ).toBeUndefined();
  });

  it('uses the most recent matching ancestor', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([
        { command: 'npx create-storybook@foo' },
        { command: 'npm' },
        { command: 'npx create-storybook@bar' },
      ])
    ).toBe('bar');
  });

  it('extracts a compact pkg.pr.new specifier from create-storybook@URL', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([
        { command: 'npx create-storybook@https://pkg.pr.new/create-storybook@abc123' },
      ])
    ).toBe('https://pkg.pr.new/create-storybook@abc123');
  });

  it('extracts a repo-scoped pkg.pr.new specifier from storybook@URL upgrade', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([
        {
          command:
            'npx storybook@https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef upgrade',
        },
      ])
    ).toBe('https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef');
  });

  it('extracts a direct pkg.pr.new create-storybook URL', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([
        {
          command: 'npx --yes https://pkg.pr.new/storybookjs/storybook/create-storybook@c83e731',
        },
      ])
    ).toBe('https://pkg.pr.new/storybookjs/storybook/create-storybook@c83e731');
  });

  it('extracts a direct pkg.pr.new storybook URL used with upgrade', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([
        {
          command: 'npx --yes https://pkg.pr.new/storybookjs/storybook/storybook@c83e731 upgrade',
        },
      ])
    ).toBe('https://pkg.pr.new/storybookjs/storybook/storybook@c83e731');
  });

  it('extracts a pkg.pr.new URL from npx --allow-remote=all', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([
        {
          command:
            'npx --yes --allow-remote=all https://pkg.pr.new/storybookjs/storybook/create-storybook@c83e731',
        },
      ])
    ).toBe('https://pkg.pr.new/storybookjs/storybook/create-storybook@c83e731');
  });

  it('extracts a quoted direct pkg.pr.new URL', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([
        {
          command: 'npx --yes "https://pkg.pr.new/storybookjs/storybook/storybook@c83e731" upgrade',
        },
      ])
    ).toBe('https://pkg.pr.new/storybookjs/storybook/storybook@c83e731');
  });

  it('extracts a specifier from a Windows-style npx.cmd invocation', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([
        {
          command:
            'npx.cmd --yes https://pkg.pr.new/storybookjs/storybook/create-storybook@c83e731',
        },
      ])
    ).toBe('https://pkg.pr.new/storybookjs/storybook/create-storybook@c83e731');
  });

  it('extracts npm tags and prerelease versions', () => {
    expect(
      getStorybookVersionSpecifierFromAncestry([{ command: 'npx storybook@next upgrade' }])
    ).toBe('next');
    expect(
      getStorybookVersionSpecifierFromAncestry([
        { command: 'npx storybook@10.6.0-alpha.7 upgrade' },
      ])
    ).toBe('10.6.0-alpha.7');
  });
});
