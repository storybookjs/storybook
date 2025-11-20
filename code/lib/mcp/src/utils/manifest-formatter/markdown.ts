import type { ComponentManifest, ComponentManifestMap } from '../../types.ts';
import type { ManifestFormatter } from './types.ts';
import { parseReactDocgen } from '../parse-react-docgen.ts';

const MAX_SUMMARY_LENGTH = 90;

/**
 * Markdown formatter for component manifests.
 * Formats component data into token-efficient markdown with headers, lists, and tables.
 * Uses adaptive formatting based on prop complexity to optimize token usage.
 */
export const markdownFormatter: ManifestFormatter = {
	formatComponentManifest(componentManifest: ComponentManifest): string {
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

		// Stories section
		if (componentManifest.stories && componentManifest.stories.length > 0) {
			parts.push('## Stories');
			parts.push('');

			for (const story of componentManifest.stories) {
				if (!story.snippet) {
					continue;
				}

				// Convert PascalCase to Human Readable Case
				const storyName = story.name.replace(/([A-Z])/g, ' $1').trim();
				parts.push(`### ${storyName}`);

				if (story.description) {
					parts.push('');
					parts.push(story.description);
				}

				parts.push('');
				parts.push('```');
				if (componentManifest.import) {
					parts.push(componentManifest.import);
					parts.push('');
				}
				parts.push(story.snippet);
				parts.push('```');
				parts.push('');
			}
		}

		// Props section
		if (componentManifest.reactDocgen) {
			const parsedDocgen = parseReactDocgen(componentManifest.reactDocgen);
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

		return parts.join('\n').trim();
	},

	formatComponentManifestMapToList(manifest: ComponentManifestMap): string {
		const parts: string[] = [];

		parts.push('# Components');
		parts.push('');

		for (const component of Object.values(manifest.components)) {
			const summary =
				component.summary ??
				(component.description
					? component.description.length > MAX_SUMMARY_LENGTH
						? `${component.description.slice(0, MAX_SUMMARY_LENGTH)}...`
						: component.description
					: undefined);

			if (summary) {
				parts.push(`- ${component.name} (${component.id}): ${summary}`);
			} else {
				parts.push(`- ${component.name} (${component.id})`);
			}
		}

		parts.push('');

		return parts.join('\n').trim();
	},
};
