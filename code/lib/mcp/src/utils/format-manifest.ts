import type {
	AllManifests,
	ComponentManifest,
	Doc,
	OutputFormat,
} from '../types.ts';
import type { ManifestFormatter } from './manifest-formatter/types.ts';
import { xmlFormatter } from './manifest-formatter/xml.ts';
import { markdownFormatter } from './manifest-formatter/markdown.ts';

const formatters: Record<OutputFormat, ManifestFormatter> = {
	xml: xmlFormatter,
	markdown: markdownFormatter,
};

/**
 * Format a single component manifest.
 */
export function formatComponentManifest(
	componentManifest: ComponentManifest,
	format: OutputFormat = 'markdown',
): string {
	return formatters[format].formatComponentManifest(componentManifest);
}

/**
 * Format a single docs manifest.
 */
export function formatDocsManifest(
	doc: Doc,
	format: OutputFormat = 'markdown',
): string {
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
