import { describe, expect, it } from 'vitest';

import type { Fix } from '../types';
import { shouldRunFix } from './checkVersionRange';

describe('shouldRunFix', () => {
  const createMockFix = (versionRange?: [string, string]): Fix => ({
    id: 'test-fix',
    versionRange: versionRange || ['*', '*'],
    check: async () => null,
    prompt: () => 'Test prompt',
    run: async () => {},
  });

  it('should return true when not an upgrade', () => {
    const fix = createMockFix(['>=6.0.0', '<7.0.0']);
    expect(shouldRunFix(fix, '6.5.0', '7.0.0', false)).toBe(true);
  });

  it('should return true when fix has no version range', () => {
    const fix = createMockFix();
    delete (fix as any).versionRange;
    expect(shouldRunFix(fix, '6.5.0', '7.0.0', true)).toBe(true);
  });

  it('should return true when versions match the range', () => {
    const fix = createMockFix(['>=6.0.0', '<=7.0.0']);
    expect(shouldRunFix(fix, '6.5.0', '7.0.0', true)).toBe(true);
  });

  it('should return false when beforeVersion is outside range', () => {
    const fix = createMockFix(['>=6.0.0', '<7.0.0']);
    expect(shouldRunFix(fix, '5.5.0', '7.0.0', true)).toBe(false);
  });

  it('should return false when afterVersion is outside range', () => {
    const fix = createMockFix(['>=6.0.0', '<7.0.0']);
    expect(shouldRunFix(fix, '6.5.0', '8.0.0', true)).toBe(false);
  });

  it('should handle prerelease versions', () => {
    const fix = createMockFix(['>=7.0.0-0', '^8.0.0-0 || ^8.0.0']);
    expect(shouldRunFix(fix, '7.0.0-rc.1', '8.0.0-alpha.1', true)).toBe(true);
  });

  it('should handle wildcard ranges', () => {
    const fix = createMockFix(['*', '*']);
    expect(shouldRunFix(fix, '5.0.0', '9.0.0', true)).toBe(true);
  });

  it('should handle complex version ranges', () => {
    const fix = createMockFix(['<9.0.0', '^9.0.0-0 || ^9.0.0']);
    expect(shouldRunFix(fix, '8.5.0', '9.0.0-rc.1', true)).toBe(true);
  });
});
