import type { AllManifests, ComponentManifest, Doc, SourceManifests, Story } from '../../types.ts';
import {
	parseReactDocgen,
	parseReactDocgenTypescript,
	type ParsedDocgen,
} from '../parse-react-docgen.ts';
import { dedent } from '../dedent.ts';
import { extractDocsSummary, MAX_SUMMARY_LENGTH } from './extract-docs-summary.ts';

/**
 * Maximum number of stories to show in full detail in component manifests.
 * Remaining stories will be shown as names only.
 */
export const MAX_STORIES_TO_SHOW = 3;

function formatComponentLine(component: ComponentManifest): string {
	const summary =
		component.summary ??
		(component.description
			? component.description.length > MAX_SUMMARY_LENGTH
				? `${component.description.slice(0, MAX_SUMMARY_LENGTH)}...`
				: component.description
			: undefined);

	if (summary) {
		return `- ${component.name} (${component.id}): ${summary}`;
	}
	return `- ${component.name} (${component.id})`;
}

function formatDocLine(doc: Doc): string {
	const summary = doc.summary ?? extractDocsSummary(doc.content);
	return `- ${doc.title} (${doc.id})${summary ? `: ${summary}` : ''}`;
}

/**
 * Extracts a summary from an object with optional summary and description fields.
 * Prefers summary if available, otherwise truncates description to maxLength.
 */
function extractSummary(
	item: { summary?: string; description?: string },
	maxLength: number = MAX_SUMMARY_LENGTH,
): string | undefined {
	if (item.summary) {
		return item.summary;
	}
	if (item.description) {
		return item.description.length > maxLength
			? `${item.description.slice(0, maxLength)}...`
			: item.description;
	}
	return undefined;
}

/**
 * Extract parsed docgen from a component manifest, preferring reactDocgen over reactDocgenTypescript.
 */
function getParsedDocgen(componentManifest: ComponentManifest): ParsedDocgen | undefined {
	if (componentManifest.reactDocgen) {
		return parseReactDocgen(componentManifest.reactDocgen);
	}
	if (componentManifest.reactDocgenTypescript) {
		return parseReactDocgenTypescript(componentManifest.reactDocgenTypescript);
	}
	return undefined;
}

/**
 * Formats a story's content (description + code snippet) into markdown.
 * Reusable helper for both formatComponentManifest and formatStoryDocumentation.
 */
function formatStoryContent(story: Story, importStatement: string | undefined): string[] {
	const parts: string[] = [];

	if (story.description) {
		parts.push(story.description);
		parts.push('');
	}

	parts.push('```');
	if (importStatement) {
		parts.push(importStatement);
		parts.push('');
	}
	parts.push(story.snippet ?? '');
	parts.push('```');

	return parts;
}

/**
 * Format a single component manifest into markdown.
 */
export function formatComponentManifest(componentManifest: ComponentManifest): string {
	const parts: string[] = [];

	// Component header
	parts.push(`# ${componentManifest.name}`);
	parts.push('');
	parts.push(`ID: ${componentManifest.id}`);
	parts.push('');

	// Description section
	if (componentManifest.description) {
		parts.push(componentManifest.description);
		parts.push('');
	}

	// Parse docgen data (from either engine)
	const parsedDocgen = getParsedDocgen(componentManifest);

	// Stories section
	if (componentManifest.stories && componentManifest.stories.length > 0) {
		parts.push('## Stories');
		parts.push('');

		const storiesWithSnippets = componentManifest.stories.filter((s) => s.snippet);

		// Check if component has props - if not, show all stories fully
		const hasProps = parsedDocgen && Object.keys(parsedDocgen.props).length > 0;

		const storiesToShow = hasProps
			? storiesWithSnippets.slice(0, MAX_STORIES_TO_SHOW)
			: storiesWithSnippets;
		const remainingStories = hasProps ? storiesWithSnippets.slice(MAX_STORIES_TO_SHOW) : [];

		// Show first X stories in full detail (or all if no props)
		for (const story of storiesToShow) {
			parts.push(`### ${story.name}`);
			parts.push('');
			parts.push(...formatStoryContent(story, componentManifest.import));
			parts.push('');
		}

		// Show remaining stories as names only
		if (remainingStories.length > 0) {
			if (storiesToShow.length > 0) {
				parts.push('### Other Stories');
			}
			parts.push('');
			for (const story of remainingStories) {
				const summary = extractSummary(story);
				const summaryPart = summary ? `: ${summary}` : '';
				parts.push(`- ${story.name}${summaryPart}`);
			}
			parts.push('');
		}
	}

	// Props section
	if (parsedDocgen) {
		const propEntries = Object.entries(parsedDocgen.props);

		if (propEntries.length > 0) {
			parts.push('## Props');
			parts.push('');
			parts.push('```');
			parts.push('export type Props = {');

			for (const [propName, propInfo] of propEntries) {
				const type = propInfo.type ?? 'any';
				const isRequired = propInfo.required ?? true;
				const hasDefault = propInfo.defaultValue !== undefined;
				const hasDescription = propInfo.description !== undefined;

				// Add description as JSDoc comment if present
				if (hasDescription) {
					parts.push('  /**');
					parts.push(`    ${propInfo.description}`);
					parts.push('  */');
				}

				// Build the prop line
				let propLine = `  ${propName}`;

				// Add ? for optional props
				if (!isRequired) {
					propLine += '?';
				}

				propLine += `: ${type}`;

				// Add default value if present
				if (hasDefault) {
					propLine += ` = ${propInfo.defaultValue}`;
				}

				propLine += ';';
				parts.push(propLine);
			}

			parts.push('}');
			parts.push('```');
			parts.push('');
		}
	}

	// Attached docs section
	if (componentManifest.docs && Object.keys(componentManifest.docs).length > 0) {
		const docsWithContent = Object.values(componentManifest.docs).filter(
			(doc) => doc.content.trim().length > 0,
		);

		if (docsWithContent.length > 0) {
			parts.push('## Docs');
			parts.push('');

			for (const doc of docsWithContent) {
				parts.push(`### ${doc.name}`);
				parts.push('');

				parts.push(doc.content);
				parts.push('');
			}
		}
	}

	return parts.join('\n').trim();
}

/**
 * Format a single doc manifest into markdown.
 */
export function formatDocsManifest(doc: Doc): string {
	return dedent`# ${doc.title}

			${doc.content}`;
}

/**
 * Format a component manifest map into a markdown list.
 * @param manifest - The component manifest map to format
 * @returns Formatted string representation of the component list
 */
export function formatManifestsToLists(manifests: AllManifests): string {
	const parts: string[] = [];

	parts.push('# Components');
	parts.push('');
	for (const component of Object.values(manifests.componentManifest.components)) {
		parts.push(formatComponentLine(component));
	}
	parts.push('');

	if (!manifests.docsManifest) {
		return parts.join('\n').trim();
	}

	parts.push('# Docs');
	parts.push('');
	for (const doc of Object.values(manifests.docsManifest.docs)) {
		parts.push(formatDocLine(doc));
	}

	return parts.join('\n').trim();
}

/**
 * Format multi-source manifests into grouped lists.
 * Each source is displayed with a heading and its components/docs listed underneath.
 * @param manifests - The multi-source manifests to format
 * @returns Formatted string representation grouped by source
 */
export function formatMultiSourceManifestsToLists(manifests: SourceManifests[]): string {
	const parts: string[] = [];

	for (const { source, componentManifest, docsManifest, error } of manifests) {
		parts.push(`# ${source.title}`);
		parts.push(`id: ${source.id}`);
		parts.push('');

		if (error) {
			parts.push(`error: ${error}`);
			parts.push('');
			continue;
		}

		const components = Object.values(componentManifest.components);
		if (components.length > 0) {
			parts.push('## Components');
			parts.push('');
			for (const component of components) {
				parts.push(formatComponentLine(component));
			}
			parts.push('');
		}

		if (docsManifest && Object.keys(docsManifest.docs).length > 0) {
			parts.push('## Docs');
			parts.push('');
			for (const doc of Object.values(docsManifest.docs)) {
				parts.push(formatDocLine(doc));
			}
			parts.push('');
		}
	}

	return parts.join('\n').trim();
}

/**
 * Format a single story's documentation.
 */
export function formatStoryDocumentation(
	componentManifest: ComponentManifest,
	storyName: string,
): string {
	const story = componentManifest.stories?.find((s) => s.name === storyName);

	if (!story || !story.snippet) {
		return '';
	}

	const parts: string[] = [];

	// Component name - Story name header
	parts.push(`# ${componentManifest.name} - ${story.name}`);
	parts.push('');
	parts.push(...formatStoryContent(story, componentManifest.import));

	return parts.join('\n').trim();
}
