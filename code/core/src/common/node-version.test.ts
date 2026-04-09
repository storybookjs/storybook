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
  parseNodeVersionString,
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
    describe('strict mode (default)', () => {
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

      it('rejects odd major between ranges (21.0.0)', () => {
        expect(isNodeVersionSupported(21, 0, 0)).toBe(false);
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

    describe('permissive mode', () => {
      it('accepts major-only "22" (latest 22.x is supported)', () => {
        expect(isNodeVersionSupported(22, 0, 0, { mode: 'permissive', precision: 'major' })).toBe(
          true
        );
      });

      it('accepts major-only "20" (latest 20.x is supported)', () => {
        expect(isNodeVersionSupported(20, 0, 0, { mode: 'permissive', precision: 'major' })).toBe(
          true
        );
      });

      it('rejects major-only "18" (no supported version exists for major 18)', () => {
        expect(isNodeVersionSupported(18, 0, 0, { mode: 'permissive', precision: 'major' })).toBe(
          false
        );
      });

      it('rejects major-only "21" (no supported version exists for major 21)', () => {
        expect(isNodeVersionSupported(21, 0, 0, { mode: 'permissive', precision: 'major' })).toBe(
          false
        );
      });

      it('accepts future major-only "24" (above highest defined major)', () => {
        expect(isNodeVersionSupported(24, 0, 0, { mode: 'permissive', precision: 'major' })).toBe(
          true
        );
      });

      it('accepts major.minor "22.14" (22.14 >= 22.12)', () => {
        expect(isNodeVersionSupported(22, 14, 0, { mode: 'permissive', precision: 'minor' })).toBe(
          true
        );
      });

      it('accepts major.minor "22.12" (exactly the minimum minor)', () => {
        expect(isNodeVersionSupported(22, 12, 0, { mode: 'permissive', precision: 'minor' })).toBe(
          true
        );
      });

      it('rejects major.minor "22.11" (22.11 < 22.12)', () => {
        expect(isNodeVersionSupported(22, 11, 0, { mode: 'permissive', precision: 'minor' })).toBe(
          false
        );
      });

      it('rejects major.minor "20.18" (20.18 < 20.19)', () => {
        expect(isNodeVersionSupported(20, 18, 0, { mode: 'permissive', precision: 'minor' })).toBe(
          false
        );
      });

      it('uses strict patch comparison when precision is patch', () => {
        expect(isNodeVersionSupported(22, 12, 0, { mode: 'permissive', precision: 'patch' })).toBe(
          true
        );
        expect(isNodeVersionSupported(22, 11, 9, { mode: 'permissive', precision: 'patch' })).toBe(
          false
        );
      });
    });
  });

  describe('parseNodeVersionString', () => {
    it('parses full version with v prefix', () => {
      expect(parseNodeVersionString('v22.14.2')).toEqual({
        major: 22,
        minor: 14,
        patch: 2,
        precision: 'patch',
      });
    });

    it('parses full version without v prefix', () => {
      expect(parseNodeVersionString('22.14.2')).toEqual({
        major: 22,
        minor: 14,
        patch: 2,
        precision: 'patch',
      });
    });

    it('parses major.minor (no patch)', () => {
      expect(parseNodeVersionString('20.19')).toEqual({
        major: 20,
        minor: 19,
        patch: 0,
        precision: 'minor',
      });
    });

    it('parses bare major', () => {
      expect(parseNodeVersionString('18')).toEqual({
        major: 18,
        minor: 0,
        patch: 0,
        precision: 'major',
      });
    });

    it('parses bare major-only supported version "22"', () => {
      expect(parseNodeVersionString('22')).toEqual({
        major: 22,
        minor: 0,
        patch: 0,
        precision: 'major',
      });
    });

    it('returns undefined for lts/*', () => {
      expect(parseNodeVersionString('lts/*')).toBeUndefined();
    });

    it('returns undefined for lts/hydrogen', () => {
      expect(parseNodeVersionString('lts/hydrogen')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(parseNodeVersionString('')).toBeUndefined();
    });

    it('handles whitespace and newlines', () => {
      expect(parseNodeVersionString('  22.14.2\n')).toEqual({
        major: 22,
        minor: 14,
        patch: 2,
        precision: 'patch',
      });
    });
  });

  describe('MIN_SUPPORTED_NODE_DESCRIPTION', () => {
    it('formats current minimums as human-readable string', () => {
      expect(MIN_SUPPORTED_NODE_DESCRIPTION).toBe('20.19+ or 22.12+');
    });
  });
});
