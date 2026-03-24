import type { Options, Preset, PresetPropertyFn } from 'storybook/internal/types';

/**
 * Builder options can be specified in `core.builder.options` or `framework.options.builder`.
 * Preference is given here to `framework.options.builder` if both are specified.
 */
export async function getBuilderOptions<T extends Record<string, any>>(
  options: Options
): Promise<T | Record<string, never>> {
  const framework = await options.presets.apply('framework', {}, options);

  if (typeof framework !== 'string' && framework?.options?.builder) {
    return framework.options.builder;
  }

  const { builder } = await options.presets.apply('core', {}, options);

  if (typeof builder !== 'string' && builder?.options) {
    return builder.options as T;
  }

  return {};
}

/**
 * Extracts builder options from a resolved framework preset value. A framework preset is either a
 * plain string name or an object with an `options.builder` field.
 */
export function getFrameworkBuilderOptions(framework: Preset): Record<string, unknown> {
  return typeof framework === 'string' ? {} : (framework?.options?.builder ?? {});
}

export interface CreateCorePresetOptions {
  /** Resolved path or package name of the builder (e.g. result of `import.meta.resolve`). */
  builderName: string;
  /** Resolved path or package name of the renderer. Omit for frameworks with no renderer. */
  rendererName?: string;
  /** Optional async hook invoked after the framework is resolved but before the config is returned. */
  beforeReturn?: (framework: Preset, options: Options) => Promise<void> | void;
}

/** Factory that creates a standard `core` preset handler for framework packages. */
export function createCorePreset({
  builderName,
  rendererName,
  beforeReturn,
}: CreateCorePresetOptions): PresetPropertyFn<'core'> {
  return async (config, options) => {
    const framework = await options.presets.apply('framework');

    if (beforeReturn) {
      await beforeReturn(framework, options);
    }

    return {
      ...config,
      builder: {
        name: builderName,
        options: getFrameworkBuilderOptions(framework),
      },
      ...(rendererName !== undefined ? { renderer: rendererName } : {}),
    };
  };
}
