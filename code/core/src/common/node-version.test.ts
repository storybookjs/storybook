import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('empathic/find', { spy: true });
vi.mock('node:fs', { spy: true });
vi.mock('./utils/paths.ts', () => ({
  getProjectRoot: vi.fn(() => '/project'),
  invalidateProjectRootCache: vi.fn(),
}));

import {
  MIN_SUPPORTED_NODE_DESCRIPTION,
  formatMinVersion,
  isNodeVersionSupported,
  parseNodeVersion,
} from './node-version.ts';

describe('node-version', () => {
  describe('formatMinVersion', () => {
    it('formats major-only when minor and patch are 0', () => {
      expect(formatMinVersion({ major: 20, minor: 0, patch: 0 })).toBe('20+');
    });

    it('formats major.minor when patch is 0', () => {
      expect(formatMinVersion({ major: 20, minor: 19, patch: 0 })).toBe('20.19+');
    });

    it('formats major.minor.patch when patch is non-zero', () => {
      expect(formatMinVersion({ major: 22, minor: 22, patch: 1 })).toBe('22.22.1+');
    });
  });

  describe('isNodeVersionSupported', () => {
    it('accepts exact minimum version (20.19.0)', () => {
      expect(isNodeVersionSupported(20, 19, 0)).toBe(true);
    });

    it('accepts exact minimum version (22.12.0)', () => {
      expect(isNodeVersionSupported(22, 12, 0)).toBe(true);
    });

    it('rejects version below minimum minor (20.18.0)', () => {
      expect(isNodeVersionSupported(20, 18, 0)).toBe(false);
    });

    it('rejects version below minimum major (18.0.0)', () => {
      expect(isNodeVersionSupported(18, 0, 0)).toBe(false);
    });

    it('accepts version above minimum minor (20.20.0)', () => {
      expect(isNodeVersionSupported(20, 20, 0)).toBe(true);
    });

    it('accepts odd major between ranges (21.0.0)', () => {
      expect(isNodeVersionSupported(21, 0, 0)).toBe(true);
    });

    it('accepts future major above highest defined (24.0.0)', () => {
      expect(isNodeVersionSupported(24, 0, 0)).toBe(true);
    });

    it('rejects 22.11.0 (one minor below 22.12)', () => {
      expect(isNodeVersionSupported(22, 11, 0)).toBe(false);
    });

    it('accepts 22.12.1 (patch above minimum)', () => {
      expect(isNodeVersionSupported(22, 12, 1)).toBe(true);
    });

    it('rejects 19.99.99', () => {
      expect(isNodeVersionSupported(19, 99, 99)).toBe(false);
    });

    it('rejects major-only "22" (treated as 22.0.0 which is below 22.12)', () => {
      expect(isNodeVersionSupported(22, 0, 0)).toBe(false);
    });
  });

  describe('MIN_SUPPORTED_NODE_DESCRIPTION', () => {
    it('formats current minimums as human-readable string', () => {
      expect(MIN_SUPPORTED_NODE_DESCRIPTION).toBe('20.19+ or 22.12+');
    });
  });

  describe('parseNodeVersion', () => {
    it('parses a plain release version', () => {
      expect(parseNodeVersion('24.19.0')).toEqual({ major: 24, minor: 19, patch: 0 });
    });

    it('strips prerelease segments so supported prerelease builds pass (issue #36143)', () => {
      expect(parseNodeVersion('22.12.0-rc.1')).toEqual({ major: 22, minor: 12, patch: 0 });
      expect(parseNodeVersion('20.19.0-nightly20240519abcdef')).toEqual({
        major: 20,
        minor: 19,
        patch: 0,
      });
    });

    it('strips build metadata', () => {
      expect(parseNodeVersion('22.12.0+build.1')).toEqual({ major: 22, minor: 12, patch: 0 });
    });

    it('normalizes missing components to 0', () => {
      expect(parseNodeVersion('22')).toEqual({ major: 22, minor: 0, patch: 0 });
    });

    it('treats unparseable segments as 0 instead of NaN', () => {
      expect(parseNodeVersion('x.y.z')).toEqual({ major: 0, minor: 0, patch: 0 });
    });
  });
});
