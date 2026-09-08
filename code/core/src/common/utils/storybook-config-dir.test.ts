import { homedir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLegacyStorybookConfigDir, getStorybookConfigDir } from './storybook-config-dir.ts';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getStorybookConfigDir', () => {
  it('falls back to ~/.storybook when XDG_CONFIG_HOME is not set', () => {
    vi.stubEnv('XDG_CONFIG_HOME', undefined);

    expect(getStorybookConfigDir()).toBe(join(homedir(), '.storybook'));
  });

  it('falls back to ~/.storybook when XDG_CONFIG_HOME is empty or whitespace', () => {
    vi.stubEnv('XDG_CONFIG_HOME', '   ');

    expect(getStorybookConfigDir()).toBe(join(homedir(), '.storybook'));
  });

  it('uses $XDG_CONFIG_HOME/storybook when the variable is set', () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/home/user/.config');

    expect(getStorybookConfigDir()).toBe(join('/home/user/.config', 'storybook'));
  });

  it('reads the environment on every call', () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/first');
    expect(getStorybookConfigDir()).toBe(join('/first', 'storybook'));

    vi.stubEnv('XDG_CONFIG_HOME', '/second');
    expect(getStorybookConfigDir()).toBe(join('/second', 'storybook'));
  });
});

describe('getLegacyStorybookConfigDir', () => {
  it('is always ~/.storybook, regardless of XDG_CONFIG_HOME', () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/home/user/.config');

    expect(getLegacyStorybookConfigDir()).toBe(join(homedir(), '.storybook'));
  });
});
