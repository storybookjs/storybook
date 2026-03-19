import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as pkg from 'empathic/package';

import versions from '../versions';
import { resolvePathInStorybookCache } from './resolve-path-in-sb-cache';

vi.mock('empathic/package', () => ({
  cache: vi.fn(),
}));

vi.mock('../versions', () => ({
  default: {
    storybook: '10.3.0-alpha.1',
  },
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
    expect(result).toBe(join(mockCacheDir, versions.storybook, 'test-sub', 'test-file'));
  });

  it('should include version in the cache path when falling back to cwd', () => {
    vi.mocked(pkg.cache).mockReturnValue(undefined);
    const cwd = process.cwd();

    const result = resolvePathInStorybookCache('test-file', 'test-sub');

    expect(result).toContain(versions.storybook);
    expect(result).toBe(
      join(cwd, 'node_modules', '.cache', 'storybook', versions.storybook, 'test-sub', 'test-file')
    );
  });

  it('should use default sub directory when not provided', () => {
    const mockCacheDir = '/mock/node_modules/.cache/storybook';
    vi.mocked(pkg.cache).mockReturnValue(mockCacheDir);

    const result = resolvePathInStorybookCache('test-file');

    expect(result).toBe(join(mockCacheDir, versions.storybook, 'default', 'test-file'));
  });

  it('should handle empty file or directory name', () => {
    const mockCacheDir = '/mock/node_modules/.cache/storybook';
    vi.mocked(pkg.cache).mockReturnValue(mockCacheDir);

    const result = resolvePathInStorybookCache('', 'test-sub');

    // Note: path.join() normalizes away the trailing slash for empty strings
    expect(result).toBe(join(mockCacheDir, versions.storybook, 'test-sub'));
  });

  it('should create consistent paths for the same version', () => {
    const mockCacheDir = '/mock/node_modules/.cache/storybook';
    vi.mocked(pkg.cache).mockReturnValue(mockCacheDir);

    const result1 = resolvePathInStorybookCache('file1', 'sub1');
    const result2 = resolvePathInStorybookCache('file2', 'sub1');

    expect(result1).toContain(versions.storybook);
    expect(result2).toContain(versions.storybook);
    // Verify both paths share the same base directory by comparing parent directories
    const parent1 = result1.substring(0, result1.lastIndexOf(join('sub1', 'file1')));
    const parent2 = result2.substring(0, result2.lastIndexOf(join('sub1', 'file2')));
    expect(parent1).toBe(parent2);
  });

  it('should handle different subdirectories', () => {
    const mockCacheDir = '/mock/node_modules/.cache/storybook';
    vi.mocked(pkg.cache).mockReturnValue(mockCacheDir);

    const result1 = resolvePathInStorybookCache('test-file', 'dev-server');
    const result2 = resolvePathInStorybookCache('test-file', 'telemetry');

    expect(result1).toBe(join(mockCacheDir, versions.storybook, 'dev-server', 'test-file'));
    expect(result2).toBe(join(mockCacheDir, versions.storybook, 'telemetry', 'test-file'));
  });

  it('should use "unknown" as version when storybook version is not available', () => {
    const mockCacheDir = '/mock/node_modules/.cache/storybook';
    vi.mocked(pkg.cache).mockReturnValue(mockCacheDir);

    // Mock the versions module to return a falsy value
    vi.mocked(versions).storybook = '' as any;

    const result = resolvePathInStorybookCache('test-file', 'test-sub');

    expect(result).toContain('unknown');
    expect(result).toBe(join(mockCacheDir, 'unknown', 'test-sub', 'test-file'));

    // Reset the mock
    vi.mocked(versions).storybook = '10.3.0-alpha.1';
  });
});
