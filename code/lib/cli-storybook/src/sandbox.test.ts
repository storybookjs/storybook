import { describe, expect, it } from 'vitest';

import { getSandboxInitMessage } from './sandbox.ts';

describe('getSandboxInitMessage', () => {
  it('formats hint with version specifier when --no-init is used', () => {
    const message = getSandboxInitMessage({
      init: false,
      versionSpecifier: '11.0.0-beta.3',
    });

    expect(message).toContain('npx --yes storybook@11.0.0-beta.3 init');
  });

  it('handles version specifier that already starts with @', () => {
    const message = getSandboxInitMessage({
      init: false,
      versionSpecifier: '@next',
    });

    expect(message).toContain('npx --yes storybook@next init');
  });

  it('falls back to @latest when version specifier is not available', () => {
    const message = getSandboxInitMessage({
      init: false,
      versionSpecifier: undefined,
    });

    expect(message).toContain('npx --yes storybook@latest init');
  });

  it('adds --allow-remote=all for pkg.pr.new URL version specifiers on npm', () => {
    const message = getSandboxInitMessage({
      init: false,
      versionSpecifier: 'https://pkg.pr.new/storybookjs/storybook/storybook@sha123',
    });

    expect(message).toContain(
      'npx --yes --allow-remote=all storybook@https://pkg.pr.new/storybookjs/storybook/storybook@sha123 init'
    );
  });

  it('recommends yarn install and yarn storybook when init is true', () => {
    const message = getSandboxInitMessage({
      init: true,
      versionSpecifier: '11.0.0-beta.3',
    });

    expect(message).toContain('yarn install');
    expect(message).toContain('yarn storybook');
  });
});
