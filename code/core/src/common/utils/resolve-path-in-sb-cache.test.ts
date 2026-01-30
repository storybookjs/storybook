import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as pkg from 'empathic/package';

import versions from '../versions';
import { resolvePathInStorybookCache } from './resolve-path-in-sb-cache';

vi.mock('empathic/package', () => ({
  cache: vi.fn(),
}));

describe('resolvePathInStorybookCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include version in the cache path when using empathic cache', () => {
    const mockCacheDir = '/mock/node_modules/.cache/storybook';
    vi.mocked(pkg.cache).mockReturnValue(mockCacheDir);

    const result = resolvePathInStorybookCache('test-file', 'test-sub');

    expect(result).toContain(versions.storybook);
    expect(result).toBe(`${mockCacheDir}/${versions.storybook}/test-sub/test-file`);
  });

  it('should include version in the cache path when falling back to cwd', () => {
    vi.mocked(pkg.cache).mockReturnValue(null);
    const cwd = process.cwd();

    const result = resolvePathInStorybookCache('test-file', 'test-sub');

    expect(result).toContain(versions.storybook);
    expect(result).toBe(
      `${cwd}/node_modules/.cache/storybook/${versions.storybook}/test-sub/test-file`
    );
  });

  it('should use default sub directory when not provided', () => {
    const mockCacheDir = '/mock/node_modules/.cache/storybook';
    vi.mocked(pkg.cache).mockReturnValue(mockCacheDir);

    const result = resolvePathInStorybookCache('test-file');

    expect(result).toBe(`${mockCacheDir}/${versions.storybook}/default/test-file`);
  });

  it('should handle empty file or directory name', () => {
    const mockCacheDir = '/mock/node_modules/.cache/storybook';
    vi.mocked(pkg.cache).mockReturnValue(mockCacheDir);

    const result = resolvePathInStorybookCache('', 'test-sub');

    expect(result).toBe(`${mockCacheDir}/${versions.storybook}/test-sub/`);
  });

  it('should create consistent paths for the same version', () => {
    const mockCacheDir = '/mock/node_modules/.cache/storybook';
    vi.mocked(pkg.cache).mockReturnValue(mockCacheDir);

    const result1 = resolvePathInStorybookCache('file1', 'sub1');
    const result2 = resolvePathInStorybookCache('file2', 'sub1');

    expect(result1).toContain(versions.storybook);
    expect(result2).toContain(versions.storybook);
    expect(result1.split('/').slice(0, -1).join('/')).toBe(
      result2.split('/').slice(0, -1).join('/')
    );
  });

  it('should handle different subdirectories', () => {
    const mockCacheDir = '/mock/node_modules/.cache/storybook';
    vi.mocked(pkg.cache).mockReturnValue(mockCacheDir);

    const result1 = resolvePathInStorybookCache('test-file', 'dev-server');
    const result2 = resolvePathInStorybookCache('test-file', 'telemetry');

    expect(result1).toBe(`${mockCacheDir}/${versions.storybook}/dev-server/test-file`);
    expect(result2).toBe(`${mockCacheDir}/${versions.storybook}/telemetry/test-file`);
  });
});
