import type { WebpackPluginInstance } from 'webpack';

type PluginWithDefinitions = {
  constructor: { name: string };
  definitions?: Record<string, unknown>;
};

/**
 * Remove `process.env.NODE_ENV` from any DefinePlugin instances in the given plugins array. This
 * prevents the webpack "Conflicting values for 'process.env.NODE_ENV'" warning that occurs when
 * Angular CLI's DefinePlugin and Storybook's own DefinePlugin both define this value with
 * potentially different values.
 *
 * **This function mutates the plugin objects in-place.**
 *
 * Handles both the flattened form (`'process.env.NODE_ENV': ...`) and the nested form
 * (`'process.env': { NODE_ENV: ... }`) to cover different versions of Angular CLI's DefinePlugin
 * output.
 *
 * Note: We use `constructor.name` to identify DefinePlugin instances (matching the existing pattern
 * in the codebase) because webpack's DefinePlugin may come from different webpack instances (e.g.,
 * Angular CLI's webpack vs Storybook's webpack), making `instanceof` checks unreliable across
 * module boundaries.
 *
 * @param plugins The webpack plugin instances to process. Plugin objects are mutated in-place.
 * @returns The same plugins array, for composability.
 */
export const filterNodeEnvFromDefinePlugins = (
  plugins: (WebpackPluginInstance | null | undefined)[]
): (WebpackPluginInstance | null | undefined)[] => {
  plugins.forEach((plugin) => {
    const pluginWithDefinitions = plugin as PluginWithDefinitions | null | undefined;
    if (
      pluginWithDefinitions?.constructor?.name === 'DefinePlugin' &&
      pluginWithDefinitions.definitions
    ) {
      // Handle the flattened form: { 'process.env.NODE_ENV': '...' }
      delete pluginWithDefinitions.definitions['process.env.NODE_ENV'];

      // Handle the nested form: { 'process.env': { NODE_ENV: '...' } }
      const processEnv = pluginWithDefinitions.definitions['process.env'];
      if (processEnv !== null && typeof processEnv === 'object' && !Array.isArray(processEnv)) {
        delete (processEnv as Record<string, unknown>)['NODE_ENV'];
      }
    }
  });
  return plugins;
};
