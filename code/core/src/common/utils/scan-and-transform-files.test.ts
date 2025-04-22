import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProjectRoot } from './paths';
import { scanAndTransformFiles } from './scan-and-transform-files';

// Mock dependencies
const mocks = vi.hoisted(() => {
  return {
    prompts: vi.fn(),
    commonGlobOptions: vi.fn(),
  };
});

vi.mock('prompts', () => {
  return {
    default: mocks.prompts,
  };
});

vi.mock('./paths', () => ({
  getProjectRoot: vi.fn(),
}));

vi.mock('./common-glob-options', () => ({
  commonGlobOptions: mocks.commonGlobOptions,
}));

vi.mock('globby', () => ({ globby: vi.fn() }));

describe('scanAndTransformFiles', () => {
  const mockTransformFn = vi.fn();
  const mockTransformOptions = { option1: 'value1' };
  const mockFiles = ['/path/to/file1.js', '/path/to/file2.ts'];
  const mockErrors = [{ file: '/path/to/file1.js', error: new Error('Test error') }];

  beforeEach(() => {
    vi.resetAllMocks();

    // Import the mocked modules
    const mockedGetProjectRoot = vi.mocked(getProjectRoot);

    // Setup mock implementations
    mocks.prompts.mockResolvedValue({ glob: '**/*.{js,ts}' });
    mockedGetProjectRoot.mockReturnValue('/mock/project/root');

    // Setup globby mock
    vi.doMock('globby', async () => {
      return {
        globby: vi.fn().mockResolvedValue(mockFiles),
      };
    });

    // Setup transform function mock
    mockTransformFn.mockResolvedValue(mockErrors);
  });

  it('should scan for files and transform them', async () => {
    // Call the function under test
    const result = await scanAndTransformFiles({
      dryRun: false,
      transformFn: mockTransformFn,
      transformOptions: mockTransformOptions,
    });

    // Verify prompts was called with the right arguments
    expect(mocks.prompts).toHaveBeenCalledWith({
      type: 'text',
      name: 'glob',
      message: 'Enter a custom glob pattern to scan (or press enter to use default):',
      initial: '**/*.{mjs,cjs,js,jsx,ts,tsx,mdx}',
    });

    // Verify commonGlobOptions was called
    expect(mocks.commonGlobOptions).toHaveBeenCalledWith('');

    // Verify transformFn was called with the right arguments
    expect(mockTransformFn).toHaveBeenCalledWith(mockFiles, mockTransformOptions, false);

    // Verify the result is correct
    expect(result).toEqual(mockErrors);
  });

  it('should use custom prompt message and default glob when provided', async () => {
    // Call the function under test with custom options
    await scanAndTransformFiles({
      promptMessage: 'Custom prompt message',
      defaultGlob: '**/*.custom',
      dryRun: false,
      transformFn: mockTransformFn,
      transformOptions: mockTransformOptions,
    });

    // Verify prompts was called with the custom options
    expect(mocks.prompts).toHaveBeenCalledWith({
      type: 'text',
      name: 'glob',
      message: 'Custom prompt message',
      initial: '**/*.custom',
    });
  });

  it('should pass dry run flag to transform function', async () => {
    // Call the function under test with dryRun: true
    await scanAndTransformFiles({
      dryRun: true,
      transformFn: mockTransformFn,
      transformOptions: mockTransformOptions,
    });

    // Verify transformFn was called with dryRun: true
    expect(mockTransformFn).toHaveBeenCalledWith(mockFiles, mockTransformOptions, true);
  });
});
