import { describe, expect, it, vi } from 'vitest';

import { JsPackageManagerFactory, versions } from 'storybook/internal/common';

import type { PostinstallOptions } from '../../../lib/cli-storybook/src/add';
import postinstall from './postinstall';

vi.mock('storybook/internal/common', () => ({
  JsPackageManagerFactory: {
    getPackageManager: vi.fn(),
  },
  versions: {
    storybook: '10.4.0-alpha.4',
    '@storybook/cli': '10.4.0-alpha.4',
  },
}));

describe('addon-a11y postinstall', () => {
  it('uses the remote CLI package for automigrate when install is still in progress', async () => {
    const runPackageCommand = vi.fn().mockResolvedValue(undefined);
    vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue({
      runPackageCommand,
    } as unknown as ReturnType<typeof JsPackageManagerFactory.getPackageManager>);

    await postinstall({
      skipInstall: true,
      yes: true,
      packageManager: 'npm',
      configDir: '.storybook',
      logger: {} as PostinstallOptions['logger'],
      prompt: {} as PostinstallOptions['prompt'],
    });

    expect(runPackageCommand).toHaveBeenCalledWith({
      args: [
        `@storybook/cli@${versions['@storybook/cli']}`,
        'automigrate',
        'addon-a11y-addon-test',
        '--loglevel',
        'silent',
        '--skip-doctor',
        '--yes',
        '--package-manager',
        'npm',
        '--config-dir',
        '.storybook',
      ],
      useRemotePkg: true,
    });
  });
});
