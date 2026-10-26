import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getHostValidationWarning, warnOnDisabledHostValidation } from '../host-validation-warning';

const { mockCacheGet, mockCacheSet, mockIsCI, mockSelect, mockWarn } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockIsCI: vi.fn(),
  mockSelect: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return { ...actual, cache: { get: mockCacheGet, set: mockCacheSet }, isCI: mockIsCI };
});

vi.mock('storybook/internal/node-logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/node-logger')>();
  return {
    ...actual,
    logger: { ...actual.logger, warn: mockWarn },
    prompt: { ...actual.prompt, select: mockSelect },
  };
});

const setTTY = (stream: NodeJS.ReadStream | NodeJS.WriteStream, value: boolean | undefined) => {
  Object.defineProperty(stream, 'isTTY', { value, configurable: true, writable: true });
};

describe('getHostValidationWarning', () => {
  it('returns nothing while host validation is enabled', () => {
    expect(getHostValidationWarning({})).toBeUndefined();
    expect(getHostValidationWarning({ allowedHosts: [] })).toBeUndefined();
    expect(getHostValidationWarning({ allowedHosts: ['my-host.com'] })).toBeUndefined();
    expect(
      getHostValidationWarning({ host: '0.0.0.0', allowedHosts: ['my-host.com'] })
    ).toBeUndefined();
  });

  it('describes browser access when core.allowedHosts is true', () => {
    expect(getHostValidationWarning({ allowedHosts: true })).toEqual({
      id: 'allowed-hosts',
      message: expect.stringContaining('core.allowedHosts is set to true'),
    });
  });

  it('describes network access when --host is 0.0.0.0 without core.allowedHosts', () => {
    const expected = {
      id: 'all-interfaces',
      message: expect.stringContaining('all network interfaces'),
    };
    expect(getHostValidationWarning({ host: '0.0.0.0' })).toEqual(expected);
    expect(getHostValidationWarning({ host: '0.0.0.0', allowedHosts: [] })).toEqual(expected);
  });
});

describe('warnOnDisabledHostValidation', () => {
  const originalStdinTTY = process.stdin.isTTY;
  const originalStdoutTTY = process.stdout.isTTY;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(undefined);
    mockCacheSet.mockResolvedValue(undefined);
    mockIsCI.mockReturnValue(false);
    mockSelect.mockResolvedValue('continue');
    setTTY(process.stdin, true);
    setTTY(process.stdout, true);
  });

  afterEach(() => {
    setTTY(process.stdin, originalStdinTTY);
    setTTY(process.stdout, originalStdoutTTY);
  });

  it('does nothing while host validation is enabled', async () => {
    await warnOnDisabledHostValidation({ allowedHosts: [], cacheKey: 'key' });

    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('warns without prompting when the prompt was skipped for this project', async () => {
    mockCacheGet.mockResolvedValue(true);

    await warnOnDisabledHostValidation({ allowedHosts: true, cacheKey: 'key' });

    expect(mockCacheGet).toHaveBeenCalledWith('host-validation-prompt-skipped-allowed-hosts-key');
    expect(mockWarn).toHaveBeenCalledOnce();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('keeps prompting about one cause after the prompt was skipped for the other one', async () => {
    mockCacheGet.mockImplementation(async (key: string) =>
      key === 'host-validation-prompt-skipped-allowed-hosts-key' ? true : undefined
    );

    await warnOnDisabledHostValidation({ host: '0.0.0.0', cacheKey: 'key' });

    expect(mockCacheGet).toHaveBeenCalledWith('host-validation-prompt-skipped-all-interfaces-key');
    expect(mockWarn).toHaveBeenCalledOnce();
    expect(mockSelect).toHaveBeenCalledOnce();
  });

  it('warns without prompting in --ci mode', async () => {
    await warnOnDisabledHostValidation({ allowedHosts: true, ci: true, cacheKey: 'key' });

    expect(mockWarn).toHaveBeenCalledOnce();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('warns without prompting when stdin is not a terminal', async () => {
    setTTY(process.stdin, undefined);

    await warnOnDisabledHostValidation({ allowedHosts: true, cacheKey: 'key' });

    expect(mockWarn).toHaveBeenCalledOnce();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('warns without prompting in a CI environment', async () => {
    mockIsCI.mockReturnValue(true);

    await warnOnDisabledHostValidation({ allowedHosts: true, cacheKey: 'key' });

    expect(mockWarn).toHaveBeenCalledOnce();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('prompts with continue as the default and continues', async () => {
    await warnOnDisabledHostValidation({ allowedHosts: true, cacheKey: 'key' });

    expect(mockWarn).toHaveBeenCalledOnce();
    expect(mockSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValue: 'continue',
        options: [
          expect.objectContaining({ value: 'continue' }),
          expect.objectContaining({ value: 'dont-ask' }),
          expect.objectContaining({ value: 'abort' }),
        ],
      })
    );
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it('skips the prompt for this project when asked not to ask again', async () => {
    mockSelect.mockResolvedValue('dont-ask');

    await warnOnDisabledHostValidation({ host: '0.0.0.0', cacheKey: 'key' });

    expect(mockCacheSet).toHaveBeenCalledWith(
      'host-validation-prompt-skipped-all-interfaces-key',
      true
    );
  });

  it('exits with code 1 when aborted', async () => {
    mockSelect.mockResolvedValue('abort');
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await warnOnDisabledHostValidation({ allowedHosts: true, cacheKey: 'key' });

    expect(exit).toHaveBeenCalledWith(1);
    expect(mockCacheSet).not.toHaveBeenCalled();
    exit.mockRestore();
  });
});
