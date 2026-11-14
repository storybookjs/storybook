import { beforeEach, describe, expect, test, vi } from 'vitest';

import { blocker, validateVersionTransition } from './block-major-version.ts';

// Mock all dependencies at the top level
vi.mock('storybook/internal/common', () => ({
  versions: {
    storybook: '9.0.0',
  },
}));

vi.mock('picocolors', async (importOriginal) => {
  const { default: actual } = await importOriginal<{ default: typeof import('picocolors') }>();
  return {
    default: {
      ...actual,
      red: (s: string) => s,
      cyan: (s: string) => s,
    },
  };
});

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
    const result = validateVersionTransition('invalid', '9.0.0');
    expect(result).toBe('ok');
  });

  test('should return "ok" for invalid targetVersion', () => {
    const result = validateVersionTransition('8.0.0', 'invalid');
    expect(result).toBe('ok');
  });

  test('should return "ok" for prerelease currentVersion', () => {
    const result = validateVersionTransition('8.0.0-alpha.1', '9.0.0');
    expect(result).toBe('ok');
  });

  test('should return "ok" for prerelease targetVersion', () => {
    const result = validateVersionTransition('8.0.0', '9.0.0-alpha.1');
    expect(result).toBe('ok');
  });

  test('should return "ok" for version zero currentVersion', () => {
    const result = validateVersionTransition('0.1.0', '9.0.0');
    expect(result).toBe('ok');
  });

  test('should return "ok" for version zero targetVersion', () => {
    const result = validateVersionTransition('8.0.0', '0.1.0');
    expect(result).toBe('ok');
  });

  test('should return "ok" when current version is greater than target', () => {
    const result = validateVersionTransition('9.0.0', '8.0.0');
    expect(result).toBe('ok');
  });

  test('should return "gap-too-large" when version gap is greater than 1', () => {
    const result = validateVersionTransition('7.0.0', '9.0.0');
    expect(result).toBe('gap-too-large');
  });

  test('should return "ok" for valid single major version upgrade', () => {
    const result = validateVersionTransition('8.0.0', '9.0.0');
    expect(result).toBe('ok');
  });

  test('should return "ok" for same version', () => {
    const result = validateVersionTransition('9.0.0', '9.0.0');
    expect(result).toBe('ok');
  });
});

describe('blocker', () => {
  const mockPackageManager = {
    getAllDependencies: vi.fn(),
    getModulePackageJSON: vi.fn(),
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
    mockPackageManager.getModulePackageJSON.mockResolvedValue(null);
  });

  describe('check method', () => {
    test('should return false when storybook is not installed', async () => {
      mockPackageManager.getModulePackageJSON.mockResolvedValue(null);

      const result = await blocker.check(baseOptions);
      expect(result).toBe(false);
    });

    test('should return false when version transition is ok', async () => {
      mockPackageManager.getModulePackageJSON.mockResolvedValue({ version: '8.0.0' });

      const result = await blocker.check(baseOptions);
      expect(result).toBe(false);
    });

    test('should return false when the installed version is newer than the target', async () => {
      mockPackageManager.getModulePackageJSON.mockResolvedValue({ version: '10.0.0' });

      const result = await blocker.check(baseOptions);
      expect(result).toBe(false);
    });

    test('should return data when version gap is too large', async () => {
      mockPackageManager.getModulePackageJSON.mockResolvedValue({ version: '7.0.0' });

      const result = await blocker.check(baseOptions);
      expect(result).toEqual({
        currentVersion: '7.0.0',
        reason: 'gap-too-large',
      });
    });

    test('should return data when package.json declares a range more than one major behind', async () => {
      mockPackageManager.getAllDependencies.mockReturnValue({ storybook: '^7.6.20' });
      mockPackageManager.getModulePackageJSON.mockResolvedValue({ version: '7.6.20' });

      const result = await blocker.check(baseOptions);
      expect(result).toEqual({
        currentVersion: '7.6.20',
        reason: 'gap-too-large',
      });
    });

    test('should return false when an error occurs', async () => {
      mockPackageManager.getModulePackageJSON.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await blocker.check(baseOptions);
      expect(result).toBe(false);
    });
  });

  describe('log method', () => {
    test('should return version gap message with upgrade command when version can be coerced', () => {
      const data = {
        currentVersion: '7.0.0',
        reason: 'gap-too-large' as const,
      };

      const result = blocker.log(data);
      expect(result.title).toContain('Major Version Gap Detected');
      expect(result.message).toContain('v7.0.0');
      expect(result.message).toContain('v9.0.0');
      expect(result.message).toContain('upgrade one major version at a time');
      expect(result.message).toContain('npx storybook@8 upgrade');
    });
  });
});
