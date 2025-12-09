import { beforeEach, describe, expect, test, vi } from 'vitest';

// Import mocked modules
import * as semver from 'semver';

import { blocker, validateVersionTransition } from './block-major-version';

// Mock all dependencies at the top level
vi.mock('storybook/internal/common', () => ({
  versions: {
    storybook: '9.0.0',
  },
}));

vi.mock('picocolors', () => ({
  default: {
    red: (s: string) => s,
    cyan: (s: string) => s,
  },
}));

vi.mock('semver', () => ({
  coerce: vi.fn(),
  gt: vi.fn(),
  major: vi.fn(),
  parse: vi.fn(),
  prerelease: vi.fn(),
}));

vi.mock('ts-dedent', () => ({
  dedent: vi.fn((strings: TemplateStringsArray, ...values: any[]) => {
    // Simple dedent mock that just joins the template
    let result = strings[0];
    for (let i = 0; i < values.length; i++) {
      result += values[i] + strings[i + 1];
    }
    return result.trim();
  }),
}));

vi.mock('./types', () => ({
  createBlocker: vi.fn((blocker) => blocker),
}));

const mockedSemver = vi.mocked(semver);

describe('validateVersionTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return "ok" for missing currentVersion', () => {
    const result = validateVersionTransition('', '9.0.0');
    expect(result).toBe('ok');
  });

  test('should return "ok" for missing targetVersion', () => {
    const result = validateVersionTransition('8.0.0', '');
    expect(result).toBe('ok');
  });

  test('should return "ok" for invalid currentVersion', () => {
    mockedSemver.parse
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ major: 9, minor: 0, patch: 0 } as any);

    const result = validateVersionTransition('invalid', '9.0.0');
    expect(result).toBe('ok');
  });

  test('should return "ok" for invalid targetVersion', () => {
    mockedSemver.parse
      .mockReturnValueOnce({ major: 8, minor: 0, patch: 0 } as any)
      .mockReturnValueOnce(null);

    const result = validateVersionTransition('8.0.0', 'invalid');
    expect(result).toBe('ok');
  });

  test('should return "ok" for prerelease currentVersion', () => {
    mockedSemver.parse
      .mockReturnValueOnce({ major: 8, minor: 0, patch: 0 } as any)
      .mockReturnValueOnce({ major: 9, minor: 0, patch: 0 } as any);
    mockedSemver.prerelease.mockReturnValueOnce(['alpha', 1]).mockReturnValueOnce(null);

    const result = validateVersionTransition('8.0.0-alpha.1', '9.0.0');
    expect(result).toBe('ok');
  });

  test('should return "ok" for prerelease targetVersion', () => {
    mockedSemver.parse
      .mockReturnValueOnce({ major: 8, minor: 0, patch: 0 } as any)
      .mockReturnValueOnce({ major: 9, minor: 0, patch: 0 } as any);
    mockedSemver.prerelease.mockReturnValueOnce(null).mockReturnValueOnce(['alpha', 1]);

    const result = validateVersionTransition('8.0.0', '9.0.0-alpha.1');
    expect(result).toBe('ok');
  });

  test('should return "ok" for version zero currentVersion', () => {
    mockedSemver.parse
      .mockReturnValueOnce({ major: 0, minor: 1, patch: 0 } as any)
      .mockReturnValueOnce({ major: 9, minor: 0, patch: 0 } as any);
    mockedSemver.prerelease.mockReturnValue(null);

    const result = validateVersionTransition('0.1.0', '9.0.0');
    expect(result).toBe('ok');
  });

  test('should return "ok" for version zero targetVersion', () => {
    mockedSemver.parse
      .mockReturnValueOnce({ major: 8, minor: 0, patch: 0 } as any)
      .mockReturnValueOnce({ major: 0, minor: 1, patch: 0 } as any);
    mockedSemver.prerelease.mockReturnValue(null);

    const result = validateVersionTransition('8.0.0', '0.1.0');
    expect(result).toBe('ok');
  });

  test('should return "downgrade" when current version is greater than target', () => {
    mockedSemver.parse
      .mockReturnValueOnce({ major: 9, minor: 0, patch: 0 } as any)
      .mockReturnValueOnce({ major: 8, minor: 0, patch: 0 } as any);
    mockedSemver.prerelease.mockReturnValue(null);
    mockedSemver.gt.mockReturnValue(true);

    const result = validateVersionTransition('9.0.0', '8.0.0');
    expect(result).toBe('downgrade');
  });

  test('should return "gap-too-large" when version gap is greater than 1', () => {
    mockedSemver.parse
      .mockReturnValueOnce({ major: 7, minor: 0, patch: 0 } as any)
      .mockReturnValueOnce({ major: 9, minor: 0, patch: 0 } as any);
    mockedSemver.prerelease.mockReturnValue(null);
    mockedSemver.gt.mockReturnValue(false);

    const result = validateVersionTransition('7.0.0', '9.0.0');
    expect(result).toBe('gap-too-large');
  });

  test('should return "ok" for valid single major version upgrade', () => {
    mockedSemver.parse
      .mockReturnValueOnce({ major: 8, minor: 0, patch: 0 } as any)
      .mockReturnValueOnce({ major: 9, minor: 0, patch: 0 } as any);
    mockedSemver.prerelease.mockReturnValue(null);
    mockedSemver.gt.mockReturnValue(false);

    const result = validateVersionTransition('8.0.0', '9.0.0');
    expect(result).toBe('ok');
  });

  test('should return "ok" for same version', () => {
    mockedSemver.parse
      .mockReturnValueOnce({ major: 9, minor: 0, patch: 0 } as any)
      .mockReturnValueOnce({ major: 9, minor: 0, patch: 0 } as any);
    mockedSemver.prerelease.mockReturnValue(null);
    mockedSemver.gt.mockReturnValue(false);

    const result = validateVersionTransition('9.0.0', '9.0.0');
    expect(result).toBe('ok');
  });
});

describe('blocker', () => {
  const mockPackageManager = {
    getAllDependencies: vi.fn(),
  };

  const baseOptions = {
    packageManager: mockPackageManager,
    mainConfig: { stories: [] },
    mainConfigPath: '.storybook/main.ts',
    configDir: '.storybook',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPackageManager.getAllDependencies.mockReturnValue({});
  });

  describe('check method', () => {
    test('should return false when storybook dependency is not found', async () => {
      mockPackageManager.getAllDependencies.mockReturnValue({});

      const result = await blocker.check(baseOptions);
      expect(result).toBe(false);
    });

    test('should return false when version transition is ok', async () => {
      mockPackageManager.getAllDependencies.mockReturnValue({
        storybook: '8.0.0',
      });
      mockedSemver.parse
        .mockReturnValueOnce({ major: 8, minor: 0, patch: 0 } as any)
        .mockReturnValueOnce({ major: 9, minor: 0, patch: 0 } as any);
      mockedSemver.prerelease.mockReturnValue(null);
      mockedSemver.gt.mockReturnValue(false);

      const result = await blocker.check(baseOptions);
      expect(result).toBe(false);
    });

    test('should return data when downgrade is detected', async () => {
      mockPackageManager.getAllDependencies.mockReturnValue({
        storybook: '10.0.0',
      });
      mockedSemver.parse
        .mockReturnValueOnce({ major: 10, minor: 0, patch: 0 } as any)
        .mockReturnValueOnce({ major: 9, minor: 0, patch: 0 } as any);
      mockedSemver.prerelease.mockReturnValue(null);
      mockedSemver.gt.mockReturnValue(true);

      const result = await blocker.check(baseOptions);
      expect(result).toEqual({
        currentVersion: '10.0.0',
        reason: 'downgrade',
      });
    });

    test('should return data when version gap is too large', async () => {
      mockPackageManager.getAllDependencies.mockReturnValue({
        storybook: '7.0.0',
      });
      mockedSemver.parse
        .mockReturnValueOnce({ major: 7, minor: 0, patch: 0 } as any)
        .mockReturnValueOnce({ major: 9, minor: 0, patch: 0 } as any);
      mockedSemver.prerelease.mockReturnValue(null);
      mockedSemver.gt.mockReturnValue(false);

      const result = await blocker.check(baseOptions);
      expect(result).toEqual({
        currentVersion: '7.0.0',
        reason: 'gap-too-large',
      });
    });

    test('should return false when an error occurs', async () => {
      mockPackageManager.getAllDependencies.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await blocker.check(baseOptions);
      expect(result).toBe(false);
    });
  });

  describe('log method', () => {
    test('should return downgrade message when reason is downgrade', () => {
      const data = {
        currentVersion: '10.0.0',
        reason: 'downgrade' as const,
      };

      const result = blocker.log(data);
      expect(result.title).toContain('Downgrade Not Supported');
      expect(result.message).toContain('v10.0.0');
      expect(result.message).toContain('v9.0.0');
      expect(result.message).toContain('Downgrading is not supported');
    });

    test('should return version gap message with upgrade command when version can be coerced', () => {
      const data = {
        currentVersion: '7.0.0',
        reason: 'gap-too-large' as const,
      };

      mockedSemver.coerce.mockReturnValue({ version: '7.0.0' } as any);
      mockedSemver.major.mockReturnValue(7);

      const result = blocker.log(data);
      expect(result.title).toContain('Major Version Gap Detected');
      expect(result.message).toContain('v7.0.0');
      expect(result.message).toContain('v9.0.0');
      expect(result.message).toContain('upgrade one major version at a time');
      expect(result.message).toContain('npx storybook@8 upgrade');
    });
  });
});
