const PLUGIN_NAME = 'storybook-normalize-angular-entry-plugin';
/**
 * This plugin is designed to modify the Webpack configuration for Storybook projects that use Angular,
 * specifically to prevent multiple runtime bundle issues by merging 'main' and 'styles' entry points.
 * It ensures that only one runtime bundle is generated to avoid '__webpack_require__.nmd is not a function' errors.
 */

export default class StorybookNormalizeAngularEntryPlugin {
  constructor(options) {
    this.options = options; // Store options if future configuration is needed
  }

  apply(compiler) {
    compiler.hooks.environment.tap(PLUGIN_NAME, () => {
      // Store the original entry configuration
      const originalEntry = compiler.options.entry;

      // Overwrite the entry configuration to normalize it
      compiler.options.entry = async () => {
        let entryResult;

        // Handle the case where the original entry is a function, which could be async
        if (typeof originalEntry === 'function') {
          try {
            // Execute the function and await its result, in case it returns a promise
            entryResult = await originalEntry();
          } catch (error) {
            // Log the error and re-throw it to ensure it's visible and doesn't silently fail
            console.error('Failed to execute the entry function:', error);
            throw error;
          }
        } else {
          // If the original entry is not a function, use it as is
          entryResult = originalEntry;
        }

        // Merge 'main' and 'styles' entries if both exist
        if (entryResult && entryResult.main && entryResult.styles) {
          // Combine and deduplicate imports from 'main' and 'styles'
          return {
            main: {
              import: Array.from(
                new Set([...entryResult.main.import, ...entryResult.styles.import])
              ),
            },
          };
        }

        // If not both 'main' and 'styles' are present, return the original or resolved entry result
        return entryResult;
      };
    });

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      this.compilation = compilation;
    });
  }
}
