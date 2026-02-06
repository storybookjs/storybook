import type { Options } from 'storybook/internal/types';

/**
 * Check if @storybook/addon-a11y is enabled in the Storybook configuration.
 */
export async function isAddonA11yEnabled(options: Options): Promise<boolean> {
	try {
		// isAddonA11yEnabled is a special preset property that addon-a11y sets in its preset
		return await options.presets.apply('isAddonA11yEnabled', false);
	} catch {
		return false;
	}
}
