import { describe, expect, it } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { getDoctorDiagnostics } from './index.ts';
import { DiagnosticType } from './types.ts';

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
