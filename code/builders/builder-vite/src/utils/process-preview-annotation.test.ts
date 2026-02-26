import { describe, expect, it, vi } from 'vitest';

import { onlyWindows, skipWindows } from '../../../../vitest.helpers';
import { processPreviewAnnotation } from './process-preview-annotation';

const realpathSyncMock = vi.fn().mockImplementation((absPath: string) => {
  // By default, simulate a non-existent or regular file (no symlink) by returning the same path.
  // Individual tests can override this to simulate a symlink.
  return absPath;
});

vi.mock('node:fs', () => ({
  realpathSync: (...args: any[]) => realpathSyncMock(...args),
}));

describe('processPreviewAnnotation()', () => {
  it('should pull the `absolute` value from an object', () => {
    const annotation = {
      bare: '@storybook/addon-links/preview',
      absolute: '/Users/foo/storybook/node_modules/@storybook/addon-links/dist/preview.mjs',
    };
    const url = processPreviewAnnotation(annotation, '/Users/foo/storybook/');
    expect(url).toBe('/Users/foo/storybook/node_modules/@storybook/addon-links/dist/preview.mjs');
  });

  it('should resolve the real path when the absolute value is a symlink', () => {
    realpathSyncMock.mockReturnValueOnce('/Users/foo/storybook/addons/docs/dist/preview.mjs');
    const annotation = {
      bare: '@storybook/addon-docs/preview',
      absolute: '/Users/foo/storybook/node_modules/@storybook/addon-docs/dist/preview.mjs',
    };
    const url = processPreviewAnnotation(annotation, '/Users/foo/storybook/');
    expect(url).toBe('/Users/foo/storybook/addons/docs/dist/preview.mjs');
  });

  it('should fall back to the absolute value when realpathSync throws', () => {
    realpathSyncMock.mockImplementationOnce(() => {
      throw new Error('ENOENT');
    });
    const annotation = {
      bare: '@storybook/addon-links/preview',
      absolute: '/Users/foo/storybook/node_modules/@storybook/addon-links/dist/preview.mjs',
    };
    const url = processPreviewAnnotation(annotation, '/Users/foo/storybook/');
    expect(url).toBe('/Users/foo/storybook/node_modules/@storybook/addon-links/dist/preview.mjs');
  });

  it('should convert relative paths into absolute paths', () => {
    const annotation = './src/stories/preview';
    const url = processPreviewAnnotation(annotation, '/Users/foo/storybook/');
    expect(url).toBe('/Users/foo/storybook/src/stories/preview');
  });

  it('should keep absolute filesystem paths', () => {
    const annotation = '/Users/foo/storybook/.storybook/preview.js';
    const url = processPreviewAnnotation(annotation, '/Users/foo/storybook/');
    expect(url).toBe('/Users/foo/storybook/.storybook/preview.js');
  });

  it('should keep absolute node_modules paths', () => {
    const annotation = '/Users/foo/storybook/node_modules/storybook-addon/preview';
    const url = processPreviewAnnotation(annotation, '/Users/foo/storybook/');
    expect(url).toBe('/Users/foo/storybook/node_modules/storybook-addon/preview');
  });

  it('should convert relative paths outside the root into absolute', () => {
    const annotation = '../parent.js';
    const url = processPreviewAnnotation(annotation, '/Users/foo/storybook/');
    expect(url).toBe('/Users/foo/parent.js');
  });

  it('should not change absolute paths outside of the project root', () => {
    const annotation = '/Users/foo/parent.js';
    const url = processPreviewAnnotation(annotation, '/Users/foo/storybook/');
    expect(url).toBe(annotation);
  });

  it('should keep absolute windows filesystem paths as is', () => {
    const annotation = 'C:/foo/storybook/.storybook/preview.js';
    const url = processPreviewAnnotation(annotation, 'C:/foo/storybook');
    expect(url).toBe('C:/foo/storybook/.storybook/preview.js');
  });
  it('should convert relative paths outside the root into absolute on Windows', () => {
    const annotation = '../parent.js';
    const url = processPreviewAnnotation(annotation, 'C:/Users/foo/storybook/');
    expect(url).toBe('C:/Users/foo/parent.js');
  });

  it('should not change Windows absolute paths outside of the project root', () => {
    const annotation = 'D:/Users/foo/parent.js';
    const url = processPreviewAnnotation(annotation, 'D:/Users/foo/storybook/');
    expect(url).toBe(annotation);
  });

  it('should normalize absolute Windows paths using \\', () => {
    const annotation = 'C:\\foo\\storybook\\.storybook\\preview.js';
    const url = processPreviewAnnotation(annotation, 'C:\\foo\\storybook');
    expect(url).toBe('C:/foo/storybook/.storybook/preview.js');
  });

  it('should normalize relative Windows paths using \\', () => {
    const annotation = '.\\src\\stories\\preview';
    const url = processPreviewAnnotation(annotation, 'C:\\foo\\storybook');
    expect(url).toBe('C:/foo/storybook/src/stories/preview');
  });
});
