import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cache, loadAllPresets } from '@storybook/core/common';
import { oneWayHash, telemetry } from '@storybook/core/telemetry';

import prompts from 'prompts';

import { getErrorLevel, sendTelemetryError, withTelemetry } from './withTelemetry';

vi.mock('prompts');
vi.mock('@storybook/core/common');
vi.mock('@storybook/core/telemetry');

const cliOptions = {};

describe('withTelemetry', () => {
  it('works in happy path', async () => {
    const run = vi.fn();

    await withTelemetry('dev', { cliOptions }, run);

    expect(telemetry).toHaveBeenCalledTimes(1);
    expect(telemetry).toHaveBeenCalledWith('boot', { eventType: 'dev' }, { stripMetadata: true });
  });

  it('does not send boot when cli option is passed', async () => {
    const run = vi.fn();

    await withTelemetry('dev', { cliOptions: { disableTelemetry: true } }, run);

    expect(telemetry).toHaveBeenCalledTimes(0);
  });

  describe('when command fails', () => {
    const error = new Error('An Error!');
    const run = vi.fn(async () => {
      throw error;
    });

    it('sends boot message', async () => {
      await expect(async () =>
        withTelemetry('dev', { cliOptions, printError: vi.fn() }, run)
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledWith('boot', { eventType: 'dev' }, { stripMetadata: true });
    });

    it('does not send boot when cli option is passed', async () => {
      await expect(async () =>
        withTelemetry('dev', { cliOptions: { disableTelemetry: true }, printError: vi.fn() }, run)
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledTimes(0);
    });

    it('sends error message when no options are passed', async () => {
      await expect(async () =>
        withTelemetry('dev', { cliOptions, printError: vi.fn() }, run)
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledTimes(2);
      expect(telemetry).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ eventType: 'dev', error }),
        expect.objectContaining({})
      );
    });

    it('does not send error message when cli opt out is passed', async () => {
      await expect(async () =>
        withTelemetry('dev', { cliOptions: { disableTelemetry: true }, printError: vi.fn() }, run)
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledTimes(0);
      expect(telemetry).not.toHaveBeenCalledWith(
        'error',
        expect.objectContaining({}),
        expect.objectContaining({})
      );
    });

    it('does not send full error message when crash reports are disabled', async () => {
      vi.mocked(loadAllPresets).mockResolvedValueOnce({
        apply: async () => ({ enableCrashReports: false }) as any,
      });
      await expect(async () =>
        withTelemetry(
          'dev',
          { cliOptions: {} as any, presetOptions: {} as any, printError: vi.fn() },
          run
        )
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledTimes(2);
      expect(telemetry).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ eventType: 'dev' }),
        expect.objectContaining({})
      );
    });

    it('does send error message when crash reports are enabled', async () => {
      vi.mocked(loadAllPresets).mockResolvedValueOnce({
        apply: async () => ({ enableCrashReports: true }) as any,
      });

      await expect(async () =>
        withTelemetry(
          'dev',
          { cliOptions: {} as any, presetOptions: {} as any, printError: vi.fn() },
          run
        )
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledTimes(2);
      expect(telemetry).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ eventType: 'dev', error }),
        expect.objectContaining({})
      );
    });

    it('does not send any error message when telemetry is disabled', async () => {
      vi.mocked(loadAllPresets).mockResolvedValueOnce({
        apply: async () => ({ disableTelemetry: true }) as any,
      });

      await expect(async () =>
        withTelemetry(
          'dev',
          { cliOptions: {} as any, presetOptions: {} as any, printError: vi.fn() },
          run
        )
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledTimes(1);
      expect(telemetry).not.toHaveBeenCalledWith(
        'error',
        expect.objectContaining({}),
        expect.objectContaining({})
      );
    });

    it('does send error messages when telemetry is disabled, but crash reports are enabled', async () => {
      vi.mocked(loadAllPresets).mockResolvedValueOnce({
        apply: async () => ({ disableTelemetry: true, enableCrashReports: true }) as any,
      });

      await expect(async () =>
        withTelemetry(
          'dev',
          { cliOptions: {} as any, presetOptions: {} as any, printError: vi.fn() },
          run
        )
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledTimes(2);
      expect(telemetry).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ eventType: 'dev', error }),
        expect.objectContaining({})
      );
    });

    it('does not send  full  error messages when disabled crash reports are cached', async () => {
      vi.mocked(loadAllPresets).mockResolvedValueOnce({
        apply: async () => ({}) as any,
      });
      vi.mocked(cache.get).mockResolvedValueOnce(false);

      await expect(async () =>
        withTelemetry(
          'dev',
          { cliOptions: {} as any, presetOptions: {} as any, printError: vi.fn() },
          run
        )
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledTimes(2);
      expect(telemetry).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ eventType: 'dev' }),
        expect.objectContaining({})
      );
    });

    it('does send error messages when enabled crash reports are cached', async () => {
      vi.mocked(loadAllPresets).mockResolvedValueOnce({
        apply: async () => ({}) as any,
      });
      vi.mocked(cache.get).mockResolvedValueOnce(true);

      await expect(async () =>
        withTelemetry(
          'dev',
          { cliOptions: {} as any, presetOptions: {} as any, printError: vi.fn() },
          run
        )
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledTimes(2);
      expect(telemetry).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ eventType: 'dev', error }),
        expect.objectContaining({})
      );
    });

    it('does not send full error messages when disabled crash reports are prompted', async () => {
      vi.mocked(loadAllPresets).mockResolvedValueOnce({
        apply: async () => ({}) as any,
      });
      vi.mocked(cache.get).mockResolvedValueOnce(undefined);
      vi.mocked(prompts).mockResolvedValueOnce({ enableCrashReports: false });

      await expect(async () =>
        withTelemetry(
          'dev',
          { cliOptions: {} as any, presetOptions: {} as any, printError: vi.fn() },
          run
        )
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledTimes(2);
      expect(telemetry).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ eventType: 'dev' }),
        expect.objectContaining({})
      );
    });

    it('does send error messages when enabled crash reports are prompted', async () => {
      vi.mocked(loadAllPresets).mockResolvedValueOnce({
        apply: async () => ({}) as any,
      });
      vi.mocked(cache.get).mockResolvedValueOnce(undefined);
      vi.mocked(prompts).mockResolvedValueOnce({ enableCrashReports: true });

      await expect(async () =>
        withTelemetry(
          'dev',
          { cliOptions: {} as any, presetOptions: {} as any, printError: vi.fn() },
          run
        )
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledTimes(2);
      expect(telemetry).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ eventType: 'dev', error }),
        expect.objectContaining({})
      );
    });

    // if main.js has errors, we have no way to tell if they've disabled error reporting,
    // so we assume they have.
    it('does not send full error messages when presets fail to evaluate', async () => {
      vi.mocked(loadAllPresets).mockRejectedValueOnce(error);

      await expect(async () =>
        withTelemetry(
          'dev',
          { cliOptions: {} as any, presetOptions: {} as any, printError: vi.fn() },
          run
        )
      ).rejects.toThrow(error);

      expect(telemetry).toHaveBeenCalledTimes(2);
      expect(telemetry).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ eventType: 'dev' }),
        expect.objectContaining({})
      );
    });
  });
});

describe('sendTelemetryError', () => {
  it('handles error instances and sends telemetry', async () => {
    const options: any = {
      cliOptions: {},
      skipPrompt: false,
    };
    const mockError = new Error('Test error');
    const eventType: any = 'testEventType';

    vi.mocked(oneWayHash).mockReturnValueOnce('some-hash');

    await sendTelemetryError(mockError, eventType, options);

    expect(telemetry).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        error: mockError,
        eventType,
        isErrorInstance: true,
        errorHash: 'some-hash',
      }),
      expect.any(Object)
    );
  });

  it('handles non-error instances and sends telemetry with no-message hash', async () => {
    const options: any = {
      cliOptions: {},
      skipPrompt: false,
    };
    const mockError = { error: new Error('Test error') };
    const eventType: any = 'testEventType';

    await sendTelemetryError(mockError, eventType, options);

    expect(telemetry).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        error: mockError,
        eventType,
        isErrorInstance: false,
        errorHash: 'NO_MESSAGE',
      }),
      expect.any(Object)
    );
  });

  it('handles error with empty message and sends telemetry with empty-message hash', async () => {
    const options: any = {
      cliOptions: {},
      skipPrompt: false,
    };
    const mockError = new Error();
    const eventType: any = 'testEventType';

    await sendTelemetryError(mockError, eventType, options);

    expect(telemetry).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        error: mockError,
        eventType,
        isErrorInstance: true,
        errorHash: 'EMPTY_MESSAGE',
      }),
      expect.any(Object)
    );
  });
});

describe('getErrorLevel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns "none" when cliOptions.disableTelemetry is true', async () => {
    const options: any = {
      cliOptions: {
        disableTelemetry: true,
      },
      presetOptions: undefined,
      skipPrompt: false,
    };

    const errorLevel = await getErrorLevel(options);

    expect(errorLevel).toBe('none');
  });

  it('returns "full" when presetOptions is not provided', async () => {
    const options: any = {
      cliOptions: {
        disableTelemetry: false,
      },
      presetOptions: undefined,
      skipPrompt: false,
    };

    const errorLevel = await getErrorLevel(options);

    expect(errorLevel).toBe('full');
  });

  it('returns "full" when core.enableCrashReports is true', async () => {
    const options: any = {
      cliOptions: {
        disableTelemetry: false,
      },
      presetOptions: {},
      skipPrompt: false,
    };

    vi.mocked(loadAllPresets).mockResolvedValueOnce({
      apply: async () => ({ enableCrashReports: true }) as any,
    });
    vi.mocked(cache.get).mockResolvedValueOnce(false);

    const errorLevel = await getErrorLevel(options);

    expect(errorLevel).toBe('full');
  });

  it('returns "error" when core.enableCrashReports is false', async () => {
    const options: any = {
      cliOptions: {
        disableTelemetry: false,
      },
      presetOptions: {},
      skipPrompt: false,
    };

    vi.mocked(loadAllPresets).mockResolvedValueOnce({
      apply: async () => ({ enableCrashReports: false }) as any,
    });
    vi.mocked(cache.get).mockResolvedValueOnce(false);

    const errorLevel = await getErrorLevel(options);

    expect(errorLevel).toBe('error');
  });

  it('returns "none" when core.disableTelemetry is true', async () => {
    const options: any = {
      cliOptions: {
        disableTelemetry: false,
      },
      presetOptions: {},
      skipPrompt: false,
    };

    vi.mocked(loadAllPresets).mockResolvedValueOnce({
      apply: async () => ({ disableTelemetry: true }) as any,
    });
    vi.mocked(cache.get).mockResolvedValueOnce(false);

    const errorLevel = await getErrorLevel(options);

    expect(errorLevel).toBe('none');
  });

  it('returns "full" if cache contains crashReports true', async () => {
    const options: any = {
      cliOptions: {
        disableTelemetry: false,
      },
      presetOptions: {},
      skipPrompt: false,
    };

    vi.mocked(cache.get).mockResolvedValueOnce(true);
    vi.mocked(loadAllPresets).mockResolvedValueOnce({
      apply: async () => ({}) as any,
    });

    const errorLevel = await getErrorLevel(options);

    expect(errorLevel).toBe('full');
  });

  it('returns "error" when skipPrompt is true', async () => {
    const options: any = {
      cliOptions: {
        disableTelemetry: false,
      },
      presetOptions: {},
      skipPrompt: true,
    };

    vi.mocked(loadAllPresets).mockResolvedValueOnce({
      apply: async () => ({}) as any,
    });
    vi.mocked(cache.get).mockResolvedValueOnce(undefined);

    const errorLevel = await getErrorLevel(options);

    expect(errorLevel).toBe('error');
  });
});
