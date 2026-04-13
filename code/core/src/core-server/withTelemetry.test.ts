import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cache, isCI, loadAllPresets } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';
import { ErrorCollector, oneWayHash, telemetry } from 'storybook/internal/telemetry';

import { getErrorLevel, sendTelemetryError, withTelemetry } from './withTelemetry.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const cliOptions = {};
const originalStdoutIsTTY = process.stdout.isTTY;

const setStdoutIsTTY = (value: boolean | undefined) => {
  Object.defineProperty(process.stdout, 'isTTY', {
    value,
    configurable: true,
  });
};

afterEach(() => {
  setStdoutIsTTY(originalStdoutIsTTY);
});

describe('withTelemetry', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(ErrorCollector.getErrors).mockReturnValue([]);
    vi.mocked(telemetry).mockResolvedValue(undefined);
  });
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
        expect.objectContaining({
          eventType: 'dev',
          error: undefined, // error is only included when errorLevel === 'full'
          isErrorInstance: true,
        }),
        expect.objectContaining({})
      );
    });

    it('prompts for crash reports when init fails without preset options', async () => {
      vi.mocked(isCI).mockReturnValue(false);
      vi.mocked(cache.get).mockResolvedValueOnce(undefined);
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true);
      setStdoutIsTTY(true);

      await expect(async () =>
        withTelemetry('init', { cliOptions, printError: vi.fn() }, run)
      ).rejects.toThrow(error);

      expect(prompt.confirm).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalledWith('enableCrashReports', true);
      expect(telemetry).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          eventType: 'init',
          error: expect.objectContaining({ message: 'An Error!', name: 'Error' }),
          isErrorInstance: true,
        }),
        expect.objectContaining({ enableCrashReports: true })
      );
    });

    it('does not send full error details when init prompt is rejected', async () => {
      vi.mocked(isCI).mockReturnValue(false);
      vi.mocked(cache.get).mockResolvedValueOnce(undefined);
      vi.mocked(prompt.confirm).mockResolvedValueOnce(false);
      setStdoutIsTTY(true);

      await expect(async () =>
        withTelemetry('init', { cliOptions, printError: vi.fn() }, run)
      ).rejects.toThrow(error);

      expect(prompt.confirm).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalledWith('enableCrashReports', false);
      expect(telemetry).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          eventType: 'init',
          error: undefined,
          isErrorInstance: true,
        }),
        expect.objectContaining({ enableCrashReports: false })
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
        expect.objectContaining({
          eventType: 'dev',
          error: expect.objectContaining({ message: 'An Error!', name: 'Error' }),
          isErrorInstance: true,
        }),
        expect.objectContaining({ enableCrashReports: true })
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
        expect.objectContaining({
          eventType: 'dev',
          error: expect.objectContaining({ message: 'An Error!', name: 'Error' }),
          isErrorInstance: true,
        }),
        expect.objectContaining({ enableCrashReports: true })
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
        expect.objectContaining({
          eventType: 'dev',
          error: expect.objectContaining({ message: 'An Error!', name: 'Error' }),
          isErrorInstance: true,
        }),
        expect.objectContaining({ enableCrashReports: true })
      );
    });

    it('does not send full error messages when disabled crash reports are prompted', async () => {
      vi.mocked(loadAllPresets).mockResolvedValueOnce({
        apply: async () => ({}) as any,
      });
      vi.mocked(cache.get).mockResolvedValueOnce(undefined);
      vi.mocked(prompt.confirm).mockResolvedValueOnce(false);

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
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true);

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
        expect.objectContaining({
          eventType: 'dev',
          error: expect.objectContaining({ message: 'An Error!', name: 'Error' }),
          isErrorInstance: true,
        }),
        expect.objectContaining({ enableCrashReports: true })
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
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(ErrorCollector.getErrors).mockReturnValue([]);
  });

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
        error: undefined, // error is only included when errorLevel === 'full'
        eventType,
        isErrorInstance: true,
        errorHash: 'some-hash',
        name: 'Error',
      }),
      expect.objectContaining({
        enableCrashReports: false,
        immediate: true,
      })
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
        error: undefined, // error is only included when errorLevel === 'full'
        eventType,
        isErrorInstance: false,
        errorHash: 'NO_MESSAGE',
      }),
      expect.objectContaining({
        enableCrashReports: false,
        immediate: true,
      })
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
        error: undefined, // error is only included when errorLevel === 'full'
        eventType,
        isErrorInstance: true,
        errorHash: 'EMPTY_MESSAGE',
        name: 'Error',
      }),
      expect.objectContaining({
        enableCrashReports: false,
        immediate: true,
      })
    );
  });

  it('does not prompt for non-blocking init errors without cached consent', async () => {
    const options: any = {
      cliOptions: {},
      skipPrompt: false,
    };
    const mockError = new Error('Init non-blocking error');

    vi.mocked(isCI).mockReturnValue(false);
    vi.mocked(cache.get).mockResolvedValueOnce(undefined);
    vi.mocked(prompt.confirm).mockResolvedValueOnce(true);
    setStdoutIsTTY(true);

    await sendTelemetryError(mockError, 'init', options, false);

    expect(prompt.confirm).not.toHaveBeenCalled();
    expect(vi.mocked(cache.set).mock.calls).not.toContainEqual([
      'enableCrashReports',
      expect.anything(),
    ]);
    expect(telemetry).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        eventType: 'init',
        blocking: false,
        error: undefined,
        isErrorInstance: true,
      }),
      expect.objectContaining({
        enableCrashReports: false,
        immediate: true,
      })
    );
  });

  it('uses cached crash report consent for non-blocking init errors', async () => {
    const options: any = {
      cliOptions: {},
      skipPrompt: false,
    };
    const mockError = new Error('Init non-blocking error');

    vi.mocked(cache.get).mockResolvedValueOnce(true);

    await sendTelemetryError(mockError, 'init', options, false);

    expect(prompt.confirm).not.toHaveBeenCalled();
    expect(telemetry).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        eventType: 'init',
        blocking: false,
        error: expect.objectContaining({ message: 'Init non-blocking error', name: 'Error' }),
        isErrorInstance: true,
      }),
      expect.objectContaining({
        enableCrashReports: true,
        immediate: true,
      })
    );
  });
});

describe('getErrorLevel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(ErrorCollector.getErrors).mockReturnValue([]);
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

  it('returns "error" when presetOptions is not provided', async () => {
    const options: any = {
      cliOptions: {
        disableTelemetry: false,
      },
      presetOptions: undefined,
      skipPrompt: false,
      eventType: 'dev',
    };

    const errorLevel = await getErrorLevel(options);

    expect(errorLevel).toBe('error');
  });

  it('returns "full" for init when presetOptions are not provided and prompt is accepted', async () => {
    const options: any = {
      cliOptions: {
        disableTelemetry: false,
      },
      presetOptions: undefined,
      skipPrompt: false,
      eventType: 'init',
    };

    vi.mocked(isCI).mockReturnValue(false);
    vi.mocked(cache.get).mockResolvedValueOnce(undefined);
    vi.mocked(prompt.confirm).mockResolvedValueOnce(true);
    setStdoutIsTTY(true);

    const errorLevel = await getErrorLevel(options);

    expect(errorLevel).toBe('full');
    expect(loadAllPresets).not.toHaveBeenCalled();
    expect(prompt.confirm).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith('enableCrashReports', true);
  });

  it('returns "error" for init when presetOptions are not provided and prompt is rejected', async () => {
    const options: any = {
      cliOptions: {
        disableTelemetry: false,
      },
      presetOptions: undefined,
      skipPrompt: false,
      eventType: 'init',
    };

    vi.mocked(isCI).mockReturnValue(false);
    vi.mocked(cache.get).mockResolvedValueOnce(undefined);
    vi.mocked(prompt.confirm).mockResolvedValueOnce(false);
    setStdoutIsTTY(true);

    const errorLevel = await getErrorLevel(options);

    expect(errorLevel).toBe('error');
    expect(loadAllPresets).not.toHaveBeenCalled();
    expect(prompt.confirm).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith('enableCrashReports', false);
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
