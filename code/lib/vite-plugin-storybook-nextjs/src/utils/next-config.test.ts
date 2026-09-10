import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadConfigMock = vi.hoisted(() => vi.fn());
const normalizeConfigMock = vi.hoisted(() => vi.fn());

vi.mock('next/dist/server/config.js', () => ({
  default: loadConfigMock,
}));

vi.mock('next/dist/server/config-shared.js', () => ({
  normalizeConfig: normalizeConfigMock,
}));

import { loadNextConfig } from './next-config.ts';

const phase = 'phase-production-build';
const dir = '/project';

describe('loadNextConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Next.js config loading unchanged by default', async () => {
    const config = { distDir: '.next', experimental: {}, configFileName: 'next.config.js' };
    loadConfigMock.mockResolvedValue(config);

    await expect(loadNextConfig(phase, dir)).resolves.toBe(config);
    expect(loadConfigMock).toHaveBeenCalledOnce();
    expect(loadConfigMock).toHaveBeenCalledWith(phase, dir);
    expect(normalizeConfigMock).not.toHaveBeenCalled();
  });

  it('preserves unrelated Next.js config errors', async () => {
    const error = new Error('Invalid next.config.mjs');
    loadConfigMock.mockRejectedValue(error);

    await expect(loadNextConfig(phase, dir)).rejects.toBe(error);
    expect(loadConfigMock).toHaveBeenCalledOnce();
    expect(normalizeConfigMock).not.toHaveBeenCalled();
  });

  it('omits the Turbopack-only Rust React Compiler flag for Vite', async () => {
    const error = new Error(
      '`experimental.turbopackRustReactCompiler` is only supported with Turbopack. Please remove the option.'
    );
    const rawConfigModule = { default: vi.fn() };
    const normalizedConfig = {
      reactCompiler: true,
      experimental: {
        turbopackRustReactCompiler: true,
        typedEnv: true,
      },
    };
    const resolvedConfig = {
      ...normalizedConfig,
      experimental: { typedEnv: true },
    };

    loadConfigMock
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(rawConfigModule)
      .mockResolvedValueOnce(resolvedConfig);
    normalizeConfigMock.mockResolvedValue(normalizedConfig);

    await expect(loadNextConfig(phase, dir)).resolves.toBe(resolvedConfig);
    expect(loadConfigMock).toHaveBeenNthCalledWith(1, phase, dir);
    expect(loadConfigMock).toHaveBeenNthCalledWith(2, phase, dir, {
      rawConfig: true,
    });
    expect(normalizeConfigMock).toHaveBeenCalledWith(phase, rawConfigModule.default);
    expect(loadConfigMock).toHaveBeenNthCalledWith(3, phase, dir, {
      customConfig: {
        reactCompiler: true,
        experimental: { typedEnv: true },
      },
    });
    expect(normalizedConfig.experimental).toEqual({
      turbopackRustReactCompiler: true,
      typedEnv: true,
    });
  });

  it('normalizes a cached raw config module that is missing Next.js defaults', async () => {
    const cachedRawConfig = { distDir: '.next' };
    const normalizedConfig = {
      distDir: '.next',
      experimental: {
        turbopackRustReactCompiler: true,
        typedEnv: true,
      },
    };
    const resolvedConfig = {
      distDir: '.next',
      experimental: { typedEnv: true },
    };

    loadConfigMock.mockResolvedValueOnce(cachedRawConfig).mockResolvedValueOnce(resolvedConfig);
    normalizeConfigMock.mockResolvedValue(normalizedConfig);

    await expect(loadNextConfig(phase, dir)).resolves.toBe(resolvedConfig);
    expect(loadConfigMock).toHaveBeenNthCalledWith(1, phase, dir);
    expect(normalizeConfigMock).toHaveBeenCalledWith(phase, cachedRawConfig);
    expect(loadConfigMock).toHaveBeenNthCalledWith(2, phase, dir, {
      customConfig: {
        distDir: '.next',
        experimental: { typedEnv: true },
      },
    });
  });

  it('normalizes a cached raw config that already has a user experimental option', async () => {
    const cachedRawConfig = { experimental: { typedEnv: true } };
    const normalizedConfig = {
      experimental: {
        turbopackRustReactCompiler: true,
        typedEnv: true,
      },
    };
    const resolvedConfig = {
      experimental: { typedEnv: true },
      configFileName: 'next.config.js',
    };

    loadConfigMock.mockResolvedValueOnce(cachedRawConfig).mockResolvedValueOnce(resolvedConfig);
    normalizeConfigMock.mockResolvedValue(normalizedConfig);

    await expect(loadNextConfig(phase, dir)).resolves.toBe(resolvedConfig);
    expect(normalizeConfigMock).toHaveBeenCalledWith(phase, cachedRawConfig);
    expect(loadConfigMock).toHaveBeenNthCalledWith(2, phase, dir, {
      customConfig: {
        experimental: { typedEnv: true },
      },
    });
  });
});
