import { posix, win32 } from 'node:path';

import { describe, expect, it } from 'vitest';

import { projectPathsEqual } from './project-path.ts';

describe('projectPathsEqual', () => {
  it('treats Windows drive-letter case and separators as the same path', () => {
    expect(projectPathsEqual('C:/proj', 'c:\\proj', win32)).toBe(true);
    expect(projectPathsEqual('C:/proj', 'C:\\proj', win32)).toBe(true);
    expect(projectPathsEqual('C:/proj', 'c:/proj', win32)).toBe(true);
  });

  it('treats Windows paths that differ only in letter case as the same path', () => {
    expect(projectPathsEqual('C:/Users/Jeppe/Proj', 'c:/users/jeppe/proj', win32)).toBe(true);
  });

  it('does not match different Windows paths', () => {
    expect(projectPathsEqual('C:/proj', 'C:/other', win32)).toBe(false);
    expect(projectPathsEqual('C:/proj', 'D:/proj', win32)).toBe(false);
  });

  it('keeps POSIX path compares byte-exact', () => {
    expect(projectPathsEqual('/Users/x/foo', '/Users/x/foo', posix)).toBe(true);
    expect(projectPathsEqual('/Users/x/foo', '/Users/x/Foo', posix)).toBe(false);
  });
});
