import type {
	AllManifests,
	ComponentManifest,
	Doc,
	OutputFormat,
	SourceManifests,
} from '../types.ts';
import type { ManifestFormatter } from './manifest-formatter/types.ts';
import { xmlFormatter } from './manifest-formatter/xml.ts';
import { markdownFormatter } from './manifest-formatter/markdown.ts';

const formatters: Record<OutputFormat, ManifestFormatter> = {
	xml: xmlFormatter,
	markdown: markdownFormatter,
};

/**
 * Format a single component manifest in summary mode (optimized for token usage).
 * @param componentManifest - The component manifest to format
 * @param format - The desired output format (defaults to 'markdown')
 * @returns Formatted string representation of the component
 */
export function formatComponentManifest(
	componentManifest: ComponentManifest,
	format: OutputFormat = 'markdown',
): string {
	return formatters[format].formatComponentManifest(componentManifest);
}

/**
 * Format a single story's documentation.
 * @param componentManifest - The component manifest containing the story
 * @param storyName - The name of the story to format
 * @param format - The desired output format (defaults to 'markdown')
 * @returns Formatted string representation of the story
 */
export function formatStoryDocumentation(
	componentManifest: ComponentManifest,
	storyName: string,
	format: OutputFormat = 'markdown',
): string {
	return formatters[format].formatStoryDocumentation(componentManifest, storyName);
}

/**
 * Format a single docs manifest.
 */
export function formatDocsManifest(doc: Doc, format: OutputFormat = 'markdown'): string {
	return formatters[format].formatDocsManifest(doc);
}

/**
 * Format a component manifest and optionally a docs manifest into lists.
 */
export function formatManifestsToLists(
	manifests: AllManifests,
	format: OutputFormat = 'markdown',
): string {
	return formatters[format].formatManifestsToLists(manifests);
}

/**
 * Format multi-source manifests into grouped lists.
 */
export function formatMultiSourceManifestsToLists(
	manifests: SourceManifests[],
	format: OutputFormat = 'markdown',
): string {
	return formatters[format].formatMultiSourceManifestsToLists(manifests);
}
