import type {
	AllManifests,
	ComponentManifest,
	ComponentSubcomponentManifest,
	Doc,
	SourceManifests,
	Story,
} from '../../types.ts';
import {
	parseReactComponentMeta,
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

type ListFormattingOptions = {
	withStoryIds?: boolean;
};

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

function formatStorySubLine(story: Story): string {
	return `  - ${story.name}` + (story.id ? ` (${story.id})` : '');
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
 * Extract parsed docgen from a component manifest, preferring reactDocgen over
 * reactDocgenTypescript over reactComponentMeta.
 */
function getParsedDocgen(
	componentManifest: Pick<
		ComponentManifest | ComponentSubcomponentManifest,
		'reactDocgen' | 'reactDocgenTypescript' | 'reactComponentMeta'
	>,
): ParsedDocgen | undefined {
	if (componentManifest.reactDocgen) {
		return parseReactDocgen(componentManifest.reactDocgen);
	}
	if (componentManifest.reactDocgenTypescript) {
		return parseReactDocgenTypescript(componentManifest.reactDocgenTypescript);
	}
	if (componentManifest.reactComponentMeta) {
		return parseReactComponentMeta(componentManifest.reactComponentMeta);
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

function formatPropsSection(
	parsedDocgen: ParsedDocgen | undefined,
	options: { title?: string; typeName?: string } = {},
): string[] {
	const propEntries = parsedDocgen ? Object.entries(parsedDocgen.props) : [];

	if (propEntries.length === 0) {
		return [];
	}

	const title = options.title ?? '## Props';
	const typeName = options.typeName ?? 'Props';
	const parts: string[] = [];
	parts.push(title);
	parts.push('');
	parts.push('```');
	parts.push(`export type ${typeName} = {`);

	for (const [propName, propInfo] of propEntries) {
		const type = propInfo.type ?? 'any';
		const isRequired = propInfo.required ?? true;
		const hasDefault = propInfo.defaultValue !== undefined;
		const hasDescription = propInfo.description !== undefined;

		if (hasDescription) {
			parts.push('  /**');
			parts.push(`    ${propInfo.description}`);
			parts.push('  */');
		}

		let propLine = `  ${propName}`;
		if (!isRequired) {
			propLine += '?';
		}

		propLine += `: ${type}`;

		if (hasDefault) {
			propLine += ` = ${propInfo.defaultValue}`;
		}

		propLine += ';';
		parts.push(propLine);
	}

	parts.push('}');
	parts.push('```');
	parts.push('');

	return parts;
}

function formatSubcomponentsSection(
	subcomponents: Record<string, ComponentSubcomponentManifest> | undefined,
): string[] {
	if (!subcomponents || Object.keys(subcomponents).length === 0) {
		return [];
	}

	const parts: string[] = [];
	parts.push('## Subcomponents');
	parts.push('');

	for (const [key, subcomponent] of Object.entries(subcomponents)) {
		parts.push(`### ${subcomponent.name || key}`);
		parts.push('');

		if (subcomponent.summary) {
			parts.push(subcomponent.summary);
			parts.push('');
		}

		if (subcomponent.description) {
			parts.push(subcomponent.description);
			parts.push('');
		}

		if (subcomponent.import) {
			parts.push('```');
			parts.push(subcomponent.import);
			parts.push('```');
			parts.push('');
		}

		if (subcomponent.error) {
			parts.push(`Error: ${subcomponent.error.name}`);
			parts.push('');
			parts.push('```');
			parts.push(subcomponent.error.message);
			parts.push('```');
			parts.push('');
			continue;
		}

		const parsedDocgen = getParsedDocgen(subcomponent);
		const typeName = `${(subcomponent.name || key).replace(/\W+/g, '')}Props`;
		parts.push(...formatPropsSection(parsedDocgen, { title: '#### Props', typeName }));
	}

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

	parts.push(...formatSubcomponentsSection(componentManifest.subcomponents));

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
			if (story.id) {
				parts.push(`Story ID: ${story.id}`);
				parts.push('');
			}
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
				const storyLabel = story.id ? `${story.name} (${story.id})` : story.name;
				parts.push(`- ${storyLabel}${summaryPart}`);
			}
			parts.push('');
		}
	}

	parts.push(...formatPropsSection(parsedDocgen));

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
export function formatManifestsToLists(
	manifests: AllManifests,
	options: ListFormattingOptions = {},
): string {
	const parts: string[] = [];

	parts.push('# Components');
	parts.push('');
	for (const component of Object.values(manifests.componentManifest.components)) {
		parts.push(formatComponentLine(component));
		if (options.withStoryIds) {
			for (const story of component.stories ?? []) {
				parts.push(formatStorySubLine(story));
			}
		}
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

export function formatMultiSourceManifestsToLists(
	manifests: SourceManifests[],
	options: ListFormattingOptions = {},
): string {
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
				if (options.withStoryIds) {
					for (const story of component.stories ?? []) {
						parts.push(formatStorySubLine(story));
					}
				}
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
