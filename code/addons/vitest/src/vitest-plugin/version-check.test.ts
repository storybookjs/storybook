import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { checkStorybookVersion } from './version-check.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

const resolveCoreLocation = () => '/repo/node_modules/storybook';

beforeEach(() => {
  vi.mocked(logger.warn)
    .mockReset()
    .mockImplementation(() => {});
});

describe('checkStorybookVersion', () => {
  it('stays silent when the addon and storybook versions match', () => {
    checkStorybookVersion({
      addonVersion: '11.0.0-beta.1',
      coreVersion: '11.0.0-beta.1',
      resolveCoreLocation,
    });

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([
    ['the addon', '0.0.0-pr-37356-sha-1a2b3c4d', '11.0.3'],
    ['storybook', '11.0.3', '0.0.0-pr-37356-sha-1a2b3c4d'],
    ['both, from different builds', '0.0.0-pr-37356-sha-1a2b3c4d', '0.0.0-pr-37619-sha-5e6f7a8b'],
  ])('skips the check when %s is a canary release', (_kind, addonVersion, coreVersion) => {
    checkStorybookVersion({ addonVersion, coreVersion, resolveCoreLocation });

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([
    ['an older major', '11.0.0-beta.1', '10.6.6'],
    ['a newer major', '11.0.3', '12.0.0'],
  ])('throws a handled error when storybook is %s', (_kind, addonVersion, coreVersion) => {
    expect(() =>
      checkStorybookVersion({ addonVersion, coreVersion, resolveCoreLocation })
    ).toThrowError(
      expect.objectContaining({
        handled: true,
        message: expect.stringContaining(
          `@storybook/addon-vitest@${addonVersion} is not compatible with storybook@${coreVersion}`
        ),
      })
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([
    ['an older patch', '11.0.3', '11.0.2'],
    ['an older prerelease', '11.0.0-beta.3', '11.0.0-beta.1'],
    ['a newer patch', '11.0.2', '11.0.4'],
    ['a newer minor', '11.0.2', '11.1.0'],
    ['unreadable', '11.0.2', 'unknown'],
  ])('only warns when storybook is %s', (_kind, addonVersion, coreVersion) => {
    checkStorybookVersion({ addonVersion, coreVersion, resolveCoreLocation });

    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining(
        `@storybook/addon-vitest@${addonVersion} is running with storybook@${coreVersion}`
      )
    );
  });

  it('logs the same warning only once', () => {
    const versions = { addonVersion: '11.2.0', coreVersion: '11.2.1', resolveCoreLocation };

    checkStorybookVersion(versions);
    checkStorybookVersion(versions);

    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('says where storybook was loaded from and how to list the installed versions', () => {
    expect(() =>
      checkStorybookVersion({
        addonVersion: '11.0.0-beta.1',
        coreVersion: '10.6.6',
        resolveCoreLocation,
      })
    ).toThrowError(
      /loaded "storybook" from: \/repo\/node_modules\/storybook[\s\S]*npm ls storybook/
    );
  });

  it('leaves the location out when it cannot be resolved', () => {
    let message = '';
    try {
      checkStorybookVersion({
        addonVersion: '11.0.0-beta.1',
        coreVersion: '10.6.6',
        resolveCoreLocation: () => undefined,
      });
    } catch (error) {
      message = String(error);
    }

    expect(message).toContain('is not compatible with storybook@10.6.6');
    expect(message).not.toContain('loaded "storybook" from');
  });
});
