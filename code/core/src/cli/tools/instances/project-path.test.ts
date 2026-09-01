import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockNodePath } from '../test-support/mock-node-path.ts';
import { projectPathsEqual } from './project-path.ts';

vi.mock('node:path', { spy: true });

describe('projectPathsEqual', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('on Windows', () => {
    beforeEach(() => {
      mockNodePath('win32');
    });

    it('treats Windows drive-letter case and separators as the same path', () => {
      expect(projectPathsEqual('C:/proj', 'c:\\proj')).toBe(true);
      expect(projectPathsEqual('C:/proj', 'C:\\proj')).toBe(true);
      expect(projectPathsEqual('C:/proj', 'c:/proj')).toBe(true);
    });

    it('treats Windows paths that differ only in letter case as the same path', () => {
      expect(projectPathsEqual('C:/Users/Jeppe/Proj', 'c:/users/jeppe/proj')).toBe(true);
    });

    it('does not match different Windows paths', () => {
      expect(projectPathsEqual('C:/proj', 'C:/other')).toBe(false);
      expect(projectPathsEqual('C:/proj', 'D:/proj')).toBe(false);
    });
  });

  describe('on POSIX', () => {
    beforeEach(() => {
      mockNodePath('posix');
    });

    it('keeps POSIX path compares byte-exact', () => {
      expect(projectPathsEqual('/Users/x/foo', '/Users/x/foo')).toBe(true);
      expect(projectPathsEqual('/Users/x/foo', '/Users/x/Foo')).toBe(false);
    });
  });
});
