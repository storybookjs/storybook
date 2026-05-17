import type { StorybookConfig } from 'storybook/internal/types';

export interface ValidationError {
  field: string;
  message: string;
}

function hasNameProperty(value: unknown): value is { name: unknown } {
  return value !== null && typeof value === 'object' && 'name' in value;
}

/**
 * Validates a Storybook configuration object in strict mode.
 * This ensures the config matches the expected StorybookConfig interface.
 *
 * @param config - The configuration object to validate
 * @param strict - If true, perform strict type validation (default: false for backward compatibility)
 * @returns An array of validation errors (empty if validation passes)
 */
export function validateStorybookConfig(
  config: unknown,
  strict: boolean = false
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof config !== 'object' || config === null) {
    errors.push({
      field: 'root',
      message: 'Configuration must be an object',
    });
    return errors;
  }

  const cfg = config as Record<string, any>;

  // Check for required fields
  if (!('stories' in cfg)) {
    errors.push({
      field: 'stories',
      message: 'The "stories" field is required in the Storybook config',
    });
  }

  // Validate stories field type if present
  if ('stories' in cfg && cfg.stories !== undefined) {
    const stories = cfg.stories;
    if (
      typeof stories !== 'string' &&
      !Array.isArray(stories) &&
      typeof stories !== 'function'
    ) {
      errors.push({
        field: 'stories',
        message:
          'The "stories" field must be a string, array, or async function',
      });
    } else if (Array.isArray(stories)) {
      stories.forEach((entry, index) => {
        if (typeof entry !== 'string' && (typeof entry !== 'object' || entry === null)) {
          errors.push({
            field: `stories[${index}]`,
            message: 'Each stories entry must be a string or a glob config object',
          });
        }
      });
    }
  }

  // Validate framework field if present
  if ('framework' in cfg && cfg.framework !== undefined) {
    const framework = cfg.framework;
    if (
      typeof framework !== 'string' &&
      (typeof framework !== 'object' || framework === null)
    ) {
      errors.push({
        field: 'framework',
        message:
          'The "framework" field must be a string or an object with a "name" property',
      });
    } else if (framework !== null && typeof framework === 'object' && !hasNameProperty(framework)) {
      errors.push({
        field: 'framework',
        message:
          'Framework object must have a "name" property',
      });
    }
  }

  // Validate addons field if present
  if ('addons' in cfg && cfg.addons !== undefined) {
    const addons = cfg.addons;
    if (!Array.isArray(addons)) {
      errors.push({
        field: 'addons',
        message: 'The "addons" field must be an array',
      });
    } else {
      addons.forEach((addon, index) => {
        if (typeof addon !== 'string' && (typeof addon !== 'object' || addon === null)) {
          errors.push({
            field: `addons[${index}]`,
            message: 'Each addon must be a string or an object with a "name" property',
          });
        } else if (addon !== null && typeof addon === 'object' && !hasNameProperty(addon)) {
          errors.push({
            field: `addons[${index}]`,
            message: 'Addon object must have a "name" property',
          });
        }
      });
    }
  }

  // Validate staticDirs field if present
  if ('staticDirs' in cfg && cfg.staticDirs !== undefined) {
    const staticDirs = cfg.staticDirs;
    if (!Array.isArray(staticDirs)) {
      errors.push({
        field: 'staticDirs',
        message: 'The "staticDirs" field must be an array',
      });
    } else {
      staticDirs.forEach((dir, index) => {
        if (typeof dir !== 'string' && (typeof dir !== 'object' || dir === null)) {
          errors.push({
            field: `staticDirs[${index}]`,
            message: 'Each staticDirs entry must be a string or a {from, to} object',
          });
        }
      });
    }
  }

  // Validate core field if present
  if ('core' in cfg && cfg.core !== undefined) {
    const core = cfg.core;
    if (typeof core !== 'object' || core === null) {
      errors.push({
        field: 'core',
        message: 'The "core" field must be an object',
      });
    }
  }

  // Validate typescript field if present
  if ('typescript' in cfg && cfg.typescript !== undefined) {
    const ts = cfg.typescript;
    if (typeof ts !== 'object' || ts === null) {
      errors.push({
        field: 'typescript',
        message: 'The "typescript" field must be an object',
      });
    }
  }

  // Validate features field if present
  if ('features' in cfg && cfg.features !== undefined) {
    const features = cfg.features;
    if (typeof features !== 'object' || features === null) {
      errors.push({
        field: 'features',
        message: 'The "features" field must be an object',
      });
    }
  }

  // Validate logLevel field if present
  if ('logLevel' in cfg && cfg.logLevel !== undefined) {
    const logLevel = cfg.logLevel;
    if (typeof logLevel !== 'string') {
      errors.push({
        field: 'logLevel',
        message: 'The "logLevel" field must be a string',
      });
    }
  }

  // Strict mode: warn about unknown properties
  if (strict) {
    const knownFields = [
      'stories',
      'framework',
      'addons',
      'core',
      'staticDirs',
      'typescript',
      'features',
      'logLevel',
      'build',
      'refs',
      'babel',
      'swc',
      'docs',
      'previewBody',
      'managerHead',
      'managerBody',
      'previewHead',
      'experimental_manifests',
      'experimental_enrichCsf',
      'env',
      'previewAnnotations',
      'managerEntries',
      'previewEntries',
      'webpackFinal',
      'viteFinal',
      'babelDefault',
    ];

    Object.keys(cfg).forEach((key) => {
      if (!knownFields.includes(key)) {
        errors.push({
          field: key,
          message: `Unknown configuration property: "${key}"`,
        });
      }
    });
  }

  return errors;
}

/**
 * Type guard to check if a value is a valid StorybookConfig
 */
export function isValidStorybookConfig(
  value: unknown,
  strict?: boolean
): value is StorybookConfig {
  return validateStorybookConfig(value, strict).length === 0;
}
