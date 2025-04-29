import { describe, expect, it } from 'vitest';

import { getAutomigrateCommand } from './automigrate';

describe('getAutomigrateCommand', () => {
  it('should return the correct command', () => {
    const command = getAutomigrateCommand('addon-a11y', {
      yes: true,
      configDir: 'config',
      packageManager: 'npm',
    });
    expect(command).toEqual([
      'storybook',
      'automigrate',
      'addon-a11y',
      '--yes',
      '--config-dir',
      'config',
      '--package-manager',
      'npm',
    ]);
  });
});
