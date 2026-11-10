import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import {
  COMMUNITY_FRAMEWORK_PACKAGES,
  communityFrameworkDistTag,
  communityPackageSpecifier,
  isCommunityFrameworkPackage,
} from './community-frameworks.ts';

const packageManager = {
  latestVersion: vi.fn<JsPackageManager['latestVersion']>(),
};

const mockRegistry = (tags: Record<string, string | null>) => {
  packageManager.latestVersion.mockImplementation(async (spec) => tags[spec] ?? null);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('COMMUNITY_FRAMEWORK_PACKAGES', () => {
  it('lists every package storybook init installs from outside the monorepo', () => {
    expect([...COMMUNITY_FRAMEWORK_PACKAGES].sort()).toMatchInlineSnapshot(`
      [
        "@nuxtjs/storybook",
        "@storybook-vue/nuxt",
        "storybook-framework-qwik",
        "storybook-html-rsbuild",
        "storybook-react-rsbuild",
        "storybook-solidjs-vite",
        "storybook-vue3-rsbuild",
        "storybook-web-components-rsbuild",
      ]
    `);
  });

  it('does not include packages released from the monorepo', () => {
    expect(isCommunityFrameworkPackage('@storybook/react-vite')).toBe(false);
    expect(isCommunityFrameworkPackage('storybook')).toBe(false);
    expect(isCommunityFrameworkPackage('@storybook/builder-vite')).toBe(false);
  });
});

describe('communityFrameworkDistTag', () => {
  it.each(['11.0.0', '11.1.2', '10.6.2'])(
    'installs latest for the stable Storybook %s without querying the registry',
    async (storybookVersion) => {
      await expect(
        communityFrameworkDistTag(packageManager, 'storybook-solidjs-vite', storybookVersion)
      ).resolves.toBe('latest');
      expect(packageManager.latestVersion).not.toHaveBeenCalled();
    }
  );

  it.each(['11.0.0-alpha.6', '11.0.0-beta.1', '11.0.0-rc.1'])(
    'installs next for the Storybook prerelease %s when next is newer than latest',
    async (storybookVersion) => {
      mockRegistry({
        'storybook-solidjs-vite@next': '2.0.0-beta.3',
        'storybook-solidjs-vite': '1.4.0',
      });

      await expect(
        communityFrameworkDistTag(packageManager, 'storybook-solidjs-vite', storybookVersion)
      ).resolves.toBe('next');
    }
  );

  it('falls back to latest when the package has no next dist-tag', async () => {
    mockRegistry({ 'storybook-framework-qwik': '0.5.0' });

    await expect(
      communityFrameworkDistTag(packageManager, 'storybook-framework-qwik', '11.0.0-beta.1')
    ).resolves.toBe('latest');
  });

  it('falls back to latest when next is a leftover from an earlier release cycle', async () => {
    mockRegistry({
      '@storybook-astro/framework@next': '0.9.0-beta.2',
      '@storybook-astro/framework': '1.0.0',
    });

    await expect(
      communityFrameworkDistTag(packageManager, '@storybook-astro/framework', '11.0.0-beta.1')
    ).resolves.toBe('latest');
  });

  it('falls back to latest when next and latest point to the same version', async () => {
    mockRegistry({
      '@storybook-astro/framework@next': '1.0.0',
      '@storybook-astro/framework': '1.0.0',
    });

    await expect(
      communityFrameworkDistTag(packageManager, '@storybook-astro/framework', '11.0.0-beta.1')
    ).resolves.toBe('latest');
  });

  it('installs next when the latest lookup fails', async () => {
    mockRegistry({ '@storybook-astro/framework@next': '1.0.0-beta.1' });

    await expect(
      communityFrameworkDistTag(packageManager, '@storybook-astro/framework', '11.0.0-beta.1')
    ).resolves.toBe('next');
  });
});

describe('communityPackageSpecifier', () => {
  beforeEach(() => {
    mockRegistry({
      'storybook-solidjs-vite@next': '1.0.0-beta.1',
      'storybook-solidjs-vite': '0.9.0',
    });
  });

  it('tags a community framework package for a Storybook prerelease', async () => {
    await expect(
      communityPackageSpecifier(packageManager, 'storybook-solidjs-vite', '11.0.0-beta.1')
    ).resolves.toBe('storybook-solidjs-vite@next');
  });

  it('leaves a community framework package untagged for a stable Storybook', async () => {
    await expect(
      communityPackageSpecifier(packageManager, 'storybook-solidjs-vite', '11.0.0')
    ).resolves.toBe('storybook-solidjs-vite');
  });

  it('keeps an explicitly requested version', async () => {
    await expect(
      communityPackageSpecifier(packageManager, 'storybook-solidjs-vite@0.8.0', '11.0.0-beta.1')
    ).resolves.toBe('storybook-solidjs-vite@0.8.0');
    expect(packageManager.latestVersion).not.toHaveBeenCalled();
  });

  it('leaves monorepo and third-party packages unchanged', async () => {
    await expect(
      communityPackageSpecifier(packageManager, '@storybook/builder-vite', '11.0.0-beta.1')
    ).resolves.toBe('@storybook/builder-vite');
    await expect(communityPackageSpecifier(packageManager, 'react', '11.0.0-beta.1')).resolves.toBe(
      'react'
    );
    expect(packageManager.latestVersion).not.toHaveBeenCalled();
  });
});
