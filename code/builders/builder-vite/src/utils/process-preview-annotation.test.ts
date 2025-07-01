import { describe, expect, it } from 'vitest';

import { onlyWindows, skipWindows } from '../../../../vitest.helpers';
import { processPreviewAnnotation } from './process-preview-annotation';

describe('processPreviewAnnotation()', () => {
  it('should pull the `absolute` value from an object', () => {
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
