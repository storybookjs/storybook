import type { AllManifests, ComponentManifest, Doc } from '../../types.ts';

/**
 * Maximum length for a summary before truncation.
 */
export const MAX_SUMMARY_LENGTH = 90;

/**
 * Maximum number of stories to show in full detail in component manifests.
 * Remaining stories will be shown as names only.
 */
export const MAX_STORIES_TO_SHOW = 3;

/**
 * Interface for manifest formatters.
 * Implementations must provide methods to format both single components
 * and component lists in their respective formats (XML, Markdown, etc).
 */
export interface ManifestFormatter {
	/**
	 * Format a single component manifest into the target format.
	 */
	formatComponentManifest(componentManifest: ComponentManifest): string;

	/**
	 * Format a single doc manifest into the target format.
	 */
	formatDocsManifest(doc: Doc): string;

	/**
	 * Format a component manifest map into a list in the target format.
	 * @param manifest - The component manifest map to format
	 * @returns Formatted string representation of the component list
	 */
	formatManifestsToLists(manifests: AllManifests): string;

	/**
	 * Format a single story's documentation.
	 */
	formatStoryDocumentation(componentManifest: ComponentManifest, storyName: string): string;
}
