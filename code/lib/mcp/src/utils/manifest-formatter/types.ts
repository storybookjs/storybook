import type { ComponentManifest, ComponentManifestMap } from '../../types.ts';

/**
 * Interface for manifest formatters.
 * Implementations must provide methods to format both single components
 * and component lists in their respective formats (XML, Markdown, etc).
 */
export interface ManifestFormatter {
	/**
	 * Format a single component manifest into the target format.
	 * @param componentManifest - The component manifest to format
	 * @returns Formatted string representation of the component
	 */
	formatComponentManifest(componentManifest: ComponentManifest): string;

	/**
	 * Format a component manifest map into a list in the target format.
	 * @param manifest - The component manifest map to format
	 * @returns Formatted string representation of the component list
	 */
	formatComponentManifestMapToList(manifest: ComponentManifestMap): string;
}
