import { homedir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getInstanceRegistryDir,
  getLegacyStorybookConfigDir,
  getStorybookConfigDir,
} from './storybook-config-dir.ts';

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
});

describe('getLegacyStorybookConfigDir', () => {
  it('is always ~/.storybook, regardless of XDG_CONFIG_HOME', () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/home/user/.config');

    expect(getLegacyStorybookConfigDir()).toBe(join(homedir(), '.storybook'));
  });
});

describe('getInstanceRegistryDir', () => {
  it('uses ~/.storybook/instances when XDG_STATE_HOME is not set', () => {
    vi.stubEnv('XDG_STATE_HOME', undefined);
    expect(getInstanceRegistryDir()).toBe(join(homedir(), '.storybook', 'instances'));
  });

  it('uses $XDG_STATE_HOME/storybook/instances when it is set', () => {
    vi.stubEnv('XDG_STATE_HOME', '/tmp/xdg-state');
    expect(getInstanceRegistryDir()).toBe(join('/tmp/xdg-state', 'storybook', 'instances'));
  });
});
