import { describe, expect, it } from 'vitest';

import { convertToFilePath } from './test-utils.ts';

describe('convertToFilePath', () => {
  it('strips file:// prefix on Unix paths', () => {
    expect(convertToFilePath('file:///usr/project/Button.stories.tsx')).toBe(
      '/usr/project/Button.stories.tsx'
    );
  });

  it('strips file:// prefix and leading slash on Windows paths', () => {
    expect(convertToFilePath('file:///C:/project/Button.stories.tsx')).toBe(
      'C:/project/Button.stories.tsx'
    );
  });

  it('decodes %20 to space', () => {
    expect(convertToFilePath('file:///C:/my%20folder/Button.stories.tsx')).toBe(
      'C:/my folder/Button.stories.tsx'
    );
  });

  it('decodes Korean characters', () => {
    expect(
      convertToFilePath('file:///C:/%ED%95%9C%EA%B8%80%ED%8F%B4%EB%8D%94/Button.stories.tsx')
    ).toBe('C:/한글폴더/Button.stories.tsx');
  });

  it('decodes accented characters (Windows)', () => {
    expect(convertToFilePath('file:///C:/caf%C3%A9/Button.stories.tsx')).toBe(
      'C:/café/Button.stories.tsx'
    );
  });

  it('decodes accented characters (Unix)', () => {
    expect(convertToFilePath('file:///usr/t%C3%A9st/Button.stories.tsx')).toBe(
      '/usr/tést/Button.stories.tsx'
    );
  });

  it('does not throw on malformed percent sequence', () => {
    expect(() => convertToFilePath('file:///C:/bad%ZZpath/Button.stories.tsx')).not.toThrow();
    expect(convertToFilePath('file:///C:/bad%ZZpath/Button.stories.tsx')).toBe(
      'C:/bad%ZZpath/Button.stories.tsx'
    );
  });
});
