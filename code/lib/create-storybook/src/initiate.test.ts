import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import prompts from 'prompts';

import { Settings } from '../../../core/src/cli/globalSettings';
import { ProjectType } from '../../../core/src/cli/project_types';
import { telemetry } from '../../../core/src/telemetry';
import { promptInstallType, promptNewUser } from './initiate';

vi.mock('prompts', { spy: true });
vi.mock('../../../core/src/telemetry');

describe('promptNewUser', () => {
  let settings: Settings;

  beforeEach(() => {
    settings = new Settings();
    settings.load = vi.fn();
    settings.save = vi.fn();
    vi.spyOn(settings, 'set');
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips prompt if non-interactive', async () => {
    const newUser = await promptNewUser({ settings, skipPrompt: true });
    expect(newUser).toBe(true);

    expect(settings.set).toHaveBeenCalledWith('init.skipOnboarding', false);
    expect(prompts).not.toHaveBeenCalled();
    expect(vi.mocked(telemetry).mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "newUser": true,
        "step": "new-user-check",
      }
    `);
  });

  it('skips prompt if user set previously opted out', async () => {
    settings.set('init.skipOnboarding', true);
    const newUser = await promptNewUser({ settings });

    expect(newUser).toBe(false);
    expect(settings.set).toHaveBeenLastCalledWith('init.skipOnboarding', true);
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
    expect(settings.set).toHaveBeenCalledWith('init.skipOnboarding', false);
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
    expect(settings.set).not.toHaveBeenCalled();
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('skips telemetry when disabled', async () => {
    prompts.inject([false]);
    const newUser = await promptNewUser({ settings, disableTelemetry: true });

    expect(prompts).toHaveBeenCalled();
    expect(newUser).toBe(false);
    expect(settings.set).toHaveBeenCalledWith('init.skipOnboarding', true);
    expect(telemetry).not.toHaveBeenCalled();
  });
});

describe('promptInstallType', () => {
  const settings = new Settings();
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
