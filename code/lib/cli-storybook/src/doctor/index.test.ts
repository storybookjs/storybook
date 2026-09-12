import { describe, expect, it } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { collectDeduplicatedDiagnostics, getDoctorDiagnostics } from './index.ts';
import { DiagnosticStatus, DiagnosticType } from './types.ts';
import type { DiagnosticMessage, ProjectDoctorResults } from './types.ts';

const packageManagerMock = {} as JsPackageManager;

const baseData = {
  configDir: '.storybook',
  packageManager: packageManagerMock,
  mainConfig: {} as StorybookConfigRaw,
};

describe('getDoctorDiagnostics', () => {
  describe('when the Storybook version cannot be determined', () => {
    it('reports the real configuration error when gathering project data failed', async () => {
      const results = await getDoctorDiagnostics({
        ...baseData,
        storybookVersion: undefined,
        configurationError: {
          title: 'Configuration Error',
          message: "❌ Storybook couldn't evaluate your .storybook/main.ts file.",
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe(DiagnosticType.CONFIGURATION_ERROR);
      expect(results[0].title).toBe('Configuration Error');
      expect(results[0].message).toContain("couldn't evaluate");
      expect(results[0].message).not.toContain('Unable to determine Storybook version');
    });

    it('falls back to the generic message when no configuration error was captured', async () => {
      const results = await getDoctorDiagnostics({
        ...baseData,
        storybookVersion: undefined,
      });

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe(DiagnosticType.CONFIGURATION_ERROR);
      expect(results[0].message).toContain('Unable to determine Storybook version');
    });
  });
});

describe('collectDeduplicatedDiagnostics', () => {
  const allPassed = Object.fromEntries(
    Object.values(DiagnosticType).map((type) => [type, DiagnosticStatus.PASSED])
  ) as Record<DiagnosticType, DiagnosticStatus>;

  const projectWithConfigurationError = (
    configDir: string,
    title: string,
    message: string
  ): ProjectDoctorResults => ({
    configDir,
    status: 'check_error',
    diagnostics: {
      ...allPassed,
      [DiagnosticType.CONFIGURATION_ERROR]: DiagnosticStatus.CHECK_ERROR,
    },
    messages: {
      [DiagnosticType.CONFIGURATION_ERROR]: { title, message },
    } as Record<DiagnosticType, DiagnosticMessage>,
  });

  it('reports different configuration errors as separate diagnostics', () => {
    const diagnostics = collectDeduplicatedDiagnostics({
      '.storybook': projectWithConfigurationError(
        '.storybook',
        'Configuration Error',
        '❌ Failed to evaluate main.ts: boom A'
      ),
      'packages/app/.storybook': projectWithConfigurationError(
        'packages/app/.storybook',
        'Configuration Error',
        '❌ Failed to evaluate main.ts: boom B'
      ),
    });

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].message).toContain('boom A');
    expect(diagnostics[0].projects).toEqual([{ configDir: '.storybook' }]);
    expect(diagnostics[1].message).toContain('boom B');
    expect(diagnostics[1].projects).toEqual([{ configDir: 'packages/app/.storybook' }]);
  });

  it('groups identical errors across projects and keeps the original title', () => {
    const diagnostics = collectDeduplicatedDiagnostics({
      '.storybook': projectWithConfigurationError(
        '.storybook',
        'Version Detection Failed',
        'same failure'
      ),
      'packages/app/.storybook': projectWithConfigurationError(
        'packages/app/.storybook',
        'Version Detection Failed',
        'same failure'
      ),
    });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].title).toBe('Version Detection Failed');
    expect(diagnostics[0].projects).toEqual([
      { configDir: '.storybook' },
      { configDir: 'packages/app/.storybook' },
    ]);
  });
});
