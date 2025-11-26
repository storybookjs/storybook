import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as paths from './paths';
import { scanAndTransformFiles } from './scan-and-transform-files';

// Mock dependencies
const mocks = vi.hoisted(() => {
  return {
    commonGlobOptions: vi.fn(),
    promptText: vi.fn(),
    globby: vi.fn(),
    loggerLog: vi.fn(),
  };
});

vi.mock('./common-glob-options', () => ({
  commonGlobOptions: mocks.commonGlobOptions,
}));

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    log: mocks.loggerLog,
  },
  prompt: {
    text: mocks.promptText,
  },
}));

vi.mock('globby', () => ({
  globby: mocks.globby,
}));

describe('scanAndTransformFiles', () => {
  const mockTransformFn = vi.fn();
  const mockTransformOptions = { option1: 'value1' };
  const mockFiles = ['/path/to/file1.js', '/path/to/file2.ts'];
  const mockErrors = [{ file: '/path/to/file1.js', error: new Error('Test error') }];

  beforeEach(() => {
    vi.resetAllMocks();

    // Import the mocked modules
    vi.spyOn(paths, 'getProjectRoot').mockReturnValue('/mock/project/root');

    // Setup mock implementations
    mocks.promptText.mockResolvedValue('**/*.{js,ts}');
    mocks.commonGlobOptions.mockReturnValue({ cwd: '/mock/project/root' });
    mocks.globby.mockResolvedValue(mockFiles);

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

    // Verify prompt.text was called with the right arguments
    expect(mocks.promptText).toHaveBeenCalledWith({
      message: 'Enter a custom glob pattern to scan (or press enter to use default):',
      initialValue: '**/*.{mjs,cjs,js,jsx,ts,tsx,mdx}',
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

    // Verify prompt.text was called with the custom options
    expect(mocks.promptText).toHaveBeenCalledWith({
      message: 'Custom prompt message',
      initialValue: '**/*.custom',
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
