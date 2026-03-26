import { describe, expect, it } from 'vitest';

import { generateProjectAnnotationsCodeFromPreviews } from './codegen-project-annotations';

describe('generateProjectAnnotationsCodeFromPreviews', () => {
  describe('isCsf4 = false (traditional preview)', () => {
    it('exports getProjectAnnotationsForVitest as alias for getProjectAnnotations', () => {
      const result = generateProjectAnnotationsCodeFromPreviews({
        previewAnnotations: ['./path/to/preview.ts'],
        projectRoot: '/project',
        frameworkName: 'react-vite',
        isCsf4: false,
      });

      expect(result).toContain('export const getProjectAnnotationsForVitest = getProjectAnnotations');
    });

    it('exports getProjectAnnotations using composeConfigs', () => {
      const result = generateProjectAnnotationsCodeFromPreviews({
        previewAnnotations: ['./path/to/preview.ts'],
        projectRoot: '/project',
        frameworkName: 'react-vite',
        isCsf4: false,
      });

      expect(result).toContain("import { composeConfigs } from 'storybook/preview-api'");
      expect(result).toContain('return composeConfigs(configs)');
    });
  });

  describe('isCsf4 = true (definePreview)', () => {
    it('exports getProjectAnnotations returning preview.default.composed', () => {
      const result = generateProjectAnnotationsCodeFromPreviews({
        previewAnnotations: ['./path/to/preview.ts'],
        projectRoot: '/project',
        frameworkName: 'react-vite',
        isCsf4: true,
      });

      expect(result).toContain('return preview.default.composed');
    });

    it('exports getProjectAnnotationsForVitest as a separate function', () => {
      const result = generateProjectAnnotationsCodeFromPreviews({
        previewAnnotations: ['./path/to/preview.ts'],
        projectRoot: '/project',
        frameworkName: 'react-vite',
        isCsf4: true,
      });

      expect(result).toContain('export function getProjectAnnotationsForVitest');
    });

    it('getProjectAnnotationsForVitest composes addons, rest, and named exports', () => {
      const result = generateProjectAnnotationsCodeFromPreviews({
        previewAnnotations: ['./path/to/preview.ts'],
        projectRoot: '/project',
        frameworkName: 'react-vite',
        isCsf4: true,
      });

      // Should destructure addons and rest from input
      expect(result).toContain('const { addons = [], ...rest } = previewModule.default?.input ?? {}');
      // Should compose all sources including the module itself (for named exports)
      expect(result).toContain('return composeConfigs([...addons, rest, previewModule])');
    });

    it('imports composeConfigs for getProjectAnnotationsForVitest', () => {
      const result = generateProjectAnnotationsCodeFromPreviews({
        previewAnnotations: ['./path/to/preview.ts'],
        projectRoot: '/project',
        frameworkName: 'react-vite',
        isCsf4: true,
      });

      expect(result).toContain("import { composeConfigs } from 'storybook/preview-api'");
    });

    it('does not change getProjectAnnotations for dev preview HMR', () => {
      const result = generateProjectAnnotationsCodeFromPreviews({
        previewAnnotations: ['./path/to/preview.ts'],
        projectRoot: '/project',
        frameworkName: 'react-vite',
        isCsf4: true,
      });

      // HMR still uses getProjectAnnotations (not the vitest variant)
      expect(result).toContain(
        'getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules)'
      );
    });
  });
});
