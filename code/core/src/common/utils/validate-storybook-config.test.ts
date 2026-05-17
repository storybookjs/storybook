import { describe, it, expect } from 'vitest';
import { validateStorybookConfig, isValidStorybookConfig } from './validate-storybook-config.ts';

describe('validateStorybookConfig', () => {
  it('should pass validation for a minimal valid config', () => {
    const config = {
      stories: ['./src/**/*.stories.ts'],
    };
    const errors = validateStorybookConfig(config);
    expect(errors).toHaveLength(0);
  });

  it('should pass validation for a complete config', () => {
    const config = {
      stories: ['./src/**/*.stories.ts'],
      framework: '@storybook/react-vite',
      addons: ['@storybook/addon-essentials'],
      core: {
        builder: '@storybook/builder-vite',
      },
    };
    const errors = validateStorybookConfig(config);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation when stories field is missing', () => {
    const config = {
      framework: '@storybook/react-vite',
    };
    const errors = validateStorybookConfig(config);
    expect(errors).toContainEqual({
      field: 'stories',
      message: 'The "stories" field is required in the Storybook config',
    });
  });

  it('should fail validation when stories has invalid type', () => {
    const config = {
      stories: 123 as any,
    };
    const errors = validateStorybookConfig(config);
    expect(errors).toContainEqual({
      field: 'stories',
      message: 'The "stories" field must be a string, array, or async function',
    });
  });

  it('should fail validation with various invalid stories types', () => {
    const invalidConfigs = [
      { stories: 123, desc: 'number' },
      { stories: true, desc: 'boolean' },
      { stories: {}, desc: 'object' },
      { stories: Symbol('test'), desc: 'symbol' },
    ];

    invalidConfigs.forEach(({ stories, desc }) => {
      const config = { stories };
      const errors = validateStorybookConfig(config);
      expect(errors.some((e) => e.field === 'stories')).toBe(true);
    });
  });

  it('should pass validation with valid stories types', () => {
    const validConfigs = [
      { stories: './src/**/*.stories.ts', desc: 'string' },
      { stories: ['./src/**/*.stories.ts'], desc: 'array' },
      { stories: () => [], desc: 'function' },
      { stories: async () => [], desc: 'async function' },
    ];

    validConfigs.forEach(({ stories, desc }) => {
      const config = { stories };
      const errors = validateStorybookConfig(config);
      expect(errors.filter((e) => e.field === 'stories')).toHaveLength(0);
    });
  });

  it('should fail validation when config is not an object', () => {
    const invalidConfigs: unknown[] = ['not an object', 123, true, null, undefined];

    invalidConfigs.forEach((config) => {
      const errors = validateStorybookConfig(config);
      expect(errors).toEqual([
        {
          field: 'root',
          message: 'Configuration must be an object',
        },
      ]);
    });
  });

  it('should detect unknown fields in strict mode', () => {
    const config = {
      stories: ['./src/**/*.stories.ts'],
      unknownField: 'should fail',
    };
    const errors = validateStorybookConfig(config, true);
    expect(errors.some((e) => e.field === 'unknownField')).toBe(true);
  });

  it('should not detect unknown fields in non-strict mode', () => {
    const config = {
      stories: ['./src/**/*.stories.ts'],
      unknownField: 'should pass',
    };
    const errors = validateStorybookConfig(config, false);
    expect(errors.every((e) => e.field !== 'unknownField')).toBe(true);
  });

  it('should validate addons array', () => {
    const config = {
      stories: ['./src/**/*.stories.ts'],
      addons: ['@storybook/addon-essentials', { name: '@storybook/addon-docs' }],
    };
    const errors = validateStorybookConfig(config);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation when addon is missing name property', () => {
    const config = {
      stories: ['./src/**/*.stories.ts'],
      addons: [{ options: {} } as any],
    };
    const errors = validateStorybookConfig(config);
    expect(errors.some((e) => e.field === 'addons[0]')).toBe(true);
  });

  it('should provide isValidStorybookConfig type guard', () => {
    const validConfig = {
      stories: ['./src/**/*.stories.ts'],
    };
    expect(isValidStorybookConfig(validConfig)).toBe(true);

    const invalidConfig = {
      framework: '@storybook/react-vite',
    };
    expect(isValidStorybookConfig(invalidConfig)).toBe(false);
  });

  it('should not throw when framework is null', () => {
    const config = {
      stories: ['./src/**/*.stories.ts'],
      framework: null,
    };
    expect(() => validateStorybookConfig(config)).not.toThrow();
    const errors = validateStorybookConfig(config);
    expect(errors.some((e) => e.field === 'framework')).toBe(true);
  });

  it('should not throw when addons contains null', () => {
    const config = {
      stories: ['./src/**/*.stories.ts'],
      addons: [null as any],
    };
    expect(() => validateStorybookConfig(config)).not.toThrow();
    const errors = validateStorybookConfig(config);
    expect(errors.some((e) => e.field === 'addons[0]')).toBe(true);
  });

  it('should validate stories array entries', () => {
    const config = {
      stories: [42 as any],
    };
    const errors = validateStorybookConfig(config);
    expect(errors.some((e) => e.field === 'stories[0]')).toBe(true);
  });

  it('should validate staticDirs array entries', () => {
    const config = {
      stories: ['./src/**/*.stories.ts'],
      staticDirs: [42 as any],
    };
    const errors = validateStorybookConfig(config);
    expect(errors.some((e) => e.field === 'staticDirs[0]')).toBe(true);
  });

  it('should not flag known fields as unknown in strict mode', () => {
    const config = {
      stories: ['./src/**/*.stories.ts'],
      env: () => ({}),
      previewAnnotations: [],
    };
    const errors = validateStorybookConfig(config, true);
    expect(errors.every((e) => e.field !== 'env' && e.field !== 'previewAnnotations')).toBe(true);
  });

  it('should accept all supported StorybookConfig strict-mode keys', () => {
    const config = {
      stories: ['./src/**/*.stories.ts'],
      previewMainTemplate: '.storybook/index.ejs',
      tags: ['autodocs'],
      experimental_indexers: [],
    };

    const errors = validateStorybookConfig(config, true);
    expect(
      errors.every(
        (e) =>
          e.field !== 'previewMainTemplate' &&
          e.field !== 'tags' &&
          e.field !== 'experimental_indexers'
      )
    ).toBe(true);
  });

  // Edge case tests for null and edge values
  describe('Edge Cases', () => {
    it('should handle framework as null without throwing', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        framework: null,
      };
      expect(() => validateStorybookConfig(config)).not.toThrow();
      const errors = validateStorybookConfig(config);
      expect(errors.some((e) => e.field === 'framework')).toBe(true);
    });

    it('should handle framework as object without name property', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        framework: { options: {} },
      };
      const errors = validateStorybookConfig(config);
      expect(errors.some((e) => e.field === 'framework' && e.message.includes('name'))).toBe(true);
    });

    it('should accept framework as object with name property', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        framework: { name: '@storybook/react-vite', options: {} },
      };
      const errors = validateStorybookConfig(config);
      expect(errors.filter((e) => e.field === 'framework')).toHaveLength(0);
    });

    it('should handle addons with null entries without throwing', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        addons: ['@storybook/addon-essentials', null, { name: '@storybook/addon-docs' }],
      };
      expect(() => validateStorybookConfig(config)).not.toThrow();
      const errors = validateStorybookConfig(config);
      expect(errors.some((e) => e.field === 'addons[1]')).toBe(true);
    });

    it('should handle core field as null', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        core: null,
      };
      expect(() => validateStorybookConfig(config)).not.toThrow();
      const errors = validateStorybookConfig(config);
      expect(errors.some((e) => e.field === 'core')).toBe(true);
    });

    it('should handle typescript field as null', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        typescript: null,
      };
      expect(() => validateStorybookConfig(config)).not.toThrow();
      const errors = validateStorybookConfig(config);
      expect(errors.some((e) => e.field === 'typescript')).toBe(true);
    });

    it('should handle features field as null', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        features: null,
      };
      expect(() => validateStorybookConfig(config)).not.toThrow();
      const errors = validateStorybookConfig(config);
      expect(errors.some((e) => e.field === 'features')).toBe(true);
    });

    it('should handle empty stories array', () => {
      const config = {
        stories: [],
      };
      const errors = validateStorybookConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should handle stories with null entries', () => {
      const config = {
        stories: ['./src/**/*.stories.ts', null, { from: './static', to: '/' }],
      };
      expect(() => validateStorybookConfig(config)).not.toThrow();
      const errors = validateStorybookConfig(config);
      expect(errors.some((e) => e.field === 'stories[1]')).toBe(true);
    });

    it('should handle staticDirs with mixed valid and invalid entries', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        staticDirs: ['./public', null, { from: './static', to: '/' }, 42],
      };
      expect(() => validateStorybookConfig(config)).not.toThrow();
      const errors = validateStorybookConfig(config);
      expect(errors.some((e) => e.field === 'staticDirs[1]')).toBe(true);
      expect(errors.some((e) => e.field === 'staticDirs[3]')).toBe(true);
    });

    it('should reject logLevel when not a string', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        logLevel: 42,
      };
      const errors = validateStorybookConfig(config);
      expect(errors.some((e) => e.field === 'logLevel')).toBe(true);
    });

    it('should accept valid logLevel strings', () => {
      const validLevels = ['silly', 'verbose', 'info', 'warn', 'error', 'fatal'];
      validLevels.forEach((level) => {
        const config = {
          stories: ['./src/**/*.stories.ts'],
          logLevel: level,
        };
        const errors = validateStorybookConfig(config);
        expect(errors.filter((e) => e.field === 'logLevel')).toHaveLength(0);
      });
    });

    it('should not flag valid known fields as unknown in strict mode', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        framework: '@storybook/react-vite',
        addons: ['@storybook/addon-essentials'],
        core: { builder: '@storybook/builder-vite' },
        staticDirs: ['./public'],
        typescript: { check: false },
        features: { buildStoriesJson: true },
        logLevel: 'info',
        build: {},
        refs: {},
        babel: {},
        swc: {},
        docs: { autodocs: true },
        previewBody: '<script></script>',
        managerHead: '<script></script>',
        previewHead: '<link/>',
        previewMainTemplate: '.storybook/template.ejs',
        tags: ['autodocs'],
        env: { custom: 'value' },
        previewAnnotations: ['./preview.js'],
        experimental_indexers: [],
        webpackFinal: () => ({}),
        viteFinal: () => ({}),
        babelDefault: {},
      };
      const errors = validateStorybookConfig(config, true);
      // Should not report any of the known fields as unknown
      const unknownFieldErrors = errors.filter((e) => e.message.includes('Unknown'));
      expect(unknownFieldErrors).toHaveLength(0);
    });

    it('should reject config with multiple concurrent errors', () => {
      const config = {
        stories: 'not-an-array-or-function',
        framework: null,
        addons: [{ options: {} }], // Missing name
        core: 'not-an-object',
        logLevel: 42,
      };
      expect(() => validateStorybookConfig(config)).not.toThrow();
      const errors = validateStorybookConfig(config);
      expect(errors.length).toBeGreaterThan(1);
      expect(errors.some((e) => e.field === 'stories')).toBe(true);
      expect(errors.some((e) => e.field === 'framework')).toBe(true);
      expect(errors.some((e) => e.field === 'addons[0]')).toBe(true);
      expect(errors.some((e) => e.field === 'core')).toBe(true);
      expect(errors.some((e) => e.field === 'logLevel')).toBe(true);
    });

    it('should handle config with undefined optional fields', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        framework: undefined,
        addons: undefined,
        core: undefined,
      };
      const errors = validateStorybookConfig(config);
      // undefined values are ignored (not present)
      expect(errors).toHaveLength(0);
    });

    it('should handle addon array with only invalid entries', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        addons: [
          { options: {} }, // Missing name
          null, // Invalid type
          'valid-string', // Valid
        ],
      };
      expect(() => validateStorybookConfig(config)).not.toThrow();
      const errors = validateStorybookConfig(config);
      expect(errors.some((e) => e.field === 'addons[0]')).toBe(true);
      expect(errors.some((e) => e.field === 'addons[1]')).toBe(true);
    });

    it('should maintain strict mode validation with all edge cases', () => {
      const config = {
        stories: ['./src/**/*.stories.ts'],
        framework: { name: '@storybook/react-vite' },
        unknownField: 'should-fail',
        typoField: 'should-fail',
      };
      const errors = validateStorybookConfig(config, true);
      expect(errors.some((e) => e.field === 'unknownField')).toBe(true);
      expect(errors.some((e) => e.field === 'typoField')).toBe(true);
      expect(errors.some((e) => e.field === 'framework')).toBe(false);
    });
  });
});
