import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType, type Settings } from 'storybook/internal/cli';
import { telemetry } from 'storybook/internal/telemetry';

import prompts from 'prompts';

import {
  getCliIntegrationFromAncestry,
  getStorybookVersionFromAncestry,
  promptInstallType,
  promptNewUser,
} from './initiate';

vi.mock('prompts', { spy: true });
vi.mock('storybook/internal/telemetry');

describe('promptNewUser', () => {
  let settings: Settings;
  beforeEach(() => {
    settings = {
      value: { version: 1 },
      save: vi.fn(),
    } as any as Settings;
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips prompt if non-interactive', async () => {
    const newUser = await promptNewUser({ settings, skipPrompt: true });
    expect(newUser).toBe(true);

    expect(settings.value.init?.skipOnboarding).toEqual(false);
    expect(prompts).not.toHaveBeenCalled();
    expect(vi.mocked(telemetry).mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "newUser": true,
        "step": "new-user-check",
      }
    `);
  });

  it('skips prompt if user set previously opted out', async () => {
    settings.value.init = { skipOnboarding: true };
    const newUser = await promptNewUser({ settings });

    expect(newUser).toBe(false);
    expect(settings.value.init?.skipOnboarding).toEqual(true);
    expect(prompts).not.toHaveBeenCalled();
    expect(vi.mocked(telemetry).mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "newUser": false,
        "step": "new-user-check",
      }
    `);
  });

  it('prompts user and sets settings when interactive', async () => {
    prompts.inject([true]);
    const newUser = await promptNewUser({ settings });

    expect(newUser).toBe(true);
    expect(settings.value.init?.skipOnboarding).toEqual(false);
    expect(prompts).toHaveBeenCalled();
    expect(vi.mocked(telemetry).mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "newUser": true,
        "step": "new-user-check",
      }
    `);
  });

  it('returns undefined when user cancels the prompt', async () => {
    prompts.inject([undefined]);
    const newUser = await promptNewUser({ settings });
    expect(prompts).toHaveBeenCalled();
    expect(newUser).toBeUndefined();
    expect(settings.value.init).toBeUndefined();
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('skips telemetry when disabled', async () => {
    prompts.inject([false]);
    const newUser = await promptNewUser({ settings, disableTelemetry: true });

    expect(prompts).toHaveBeenCalled();
    expect(newUser).toBe(false);
    expect(settings.value.init?.skipOnboarding).toEqual(true);
    expect(telemetry).not.toHaveBeenCalled();
  });
});

describe('promptInstallType', () => {
  const settings = {
    value: { version: 1 },
    save: vi.fn(),
  } as any as Settings;
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns "recommended" when not interactive', async () => {
    const result = await promptInstallType({ settings, skipPrompt: true });
    expect(result).toBe('recommended');
    expect(vi.mocked(telemetry).mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "installType": "recommended",
        "step": "install-type",
      }
    `);
  });

  it('prompts user when interactive and yes option is not set', async () => {
    prompts.inject(['recommended']);
    const result = await promptInstallType({ settings });
    expect(result).toBe('recommended');
  });

  it('returns "light" when user selects minimal configuration', async () => {
    prompts.inject(['light']);
    const result = await promptInstallType({ settings });
    expect(result).toBe('light');
  });

  it('returns undefined when user cancels the prompt', async () => {
    prompts.inject([undefined]);
    const result = await promptInstallType({ settings });
    expect(result).toBeUndefined();
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('skips telemetry when disabled', async () => {
    prompts.inject(['recommended']);
    const result = await promptInstallType({ settings, disableTelemetry: true });
    expect(result).toBe('recommended');
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('uses specific prompt options for React Native projects', async () => {
    prompts.inject(['recommended']);
    const result = await promptInstallType({
      settings,
      projectType: ProjectType.REACT_NATIVE,
    });

    expect(result).toBe('recommended');
    expect(prompts).not.toHaveBeenCalled();
    expect(vi.mocked(telemetry).mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "installType": "recommended",
        "step": "install-type",
      }
    `);
  });
});

describe('getStorybookVersionFromAncestry', () => {
  it('possible storybook path', () => {
    const ancestry = [{ command: 'node' }, { command: 'storybook@7.0.0' }, { command: 'npm' }];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBeUndefined();
  });

  it('create storybook', () => {
    const ancestry = [
      { command: 'node' },
      { command: 'npm create storybook@7.0.0-alpha.3' },
      { command: 'npm' },
    ];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBe('7.0.0-alpha.3');
  });

  it('storybook init', () => {
    const ancestry = [
      { command: 'node' },
      { command: 'npx storybook@7.0.0 init' },
      { command: 'npm' },
    ];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBe('7.0.0');
  });

  it('storybook init no version', () => {
    const ancestry = [{ command: 'node' }, { command: 'npx storybook init' }, { command: 'npm' }];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBeUndefined();
  });

  it('create-storybook with latest', () => {
    const ancestry = [
      { command: 'node' },
      { command: 'npx create-storybook@latest' },
      { command: 'npm' },
    ];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBe('latest');
  });

  it('foo-storybook with latest', () => {
    const ancestry = [
      { command: 'node' },
      { command: 'npx foo-storybook@latest' },
      { command: 'npm' },
    ];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBeUndefined();
  });

  it('multiple matches', () => {
    const ancestry = [
      { command: 'node' },
      { command: 'npx create-storybook@foo' },
      { command: 'npm' },
      { command: 'npx create-storybook@bar' },
    ];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBe('bar');
  });

  it('returns undefined if no storybook version found', () => {
    const ancestry = [{ command: 'node' }, { command: 'npm' }];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBeUndefined();
  });
});

describe('getCliIntegrationFromAncestry', () => {
  it('returns the CLI integration if nested calls', () => {
    const ancestry = [{ command: 'node' }, { command: 'npx sv add' }, { command: 'npx sv create' }];
    expect(getCliIntegrationFromAncestry(ancestry as any)).toBe('sv create');
  });

  it('returns the CLI integration if found', () => {
    const ancestry = [{ command: 'node' }, { command: 'npx sv add' }];
    expect(getCliIntegrationFromAncestry(ancestry as any)).toBe('sv add');
  });

  it('returns the CLI integration if found', () => {
    const ancestry = [{ command: 'node' }, { command: 'npx sv@latest add' }];
    expect(getCliIntegrationFromAncestry(ancestry as any)).toBe('sv add');
  });

  it('returns undefined if no CLI integration found', () => {
    const ancestry = [{ command: 'node' }, { command: 'npm' }];
    expect(getCliIntegrationFromAncestry(ancestry as any)).toBeUndefined();
  });
});
