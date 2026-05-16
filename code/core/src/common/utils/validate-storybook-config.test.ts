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
      stories: 123,
    };
    const errors = validateStorybookConfig(config);
    expect(errors.some((e) => e.field === 'stories')).toBe(true);
  });

  it('should fail validation when config is not an object', () => {
    const config = 'not an object';
    const errors = validateStorybookConfig(config);
    expect(errors).toContainEqual({
      field: 'root',
      message: 'Configuration must be an object',
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
      addons: [{ options: {} }],
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
});
