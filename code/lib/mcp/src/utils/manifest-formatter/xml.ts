import { MAX_SUMMARY_LENGTH, MAX_STORIES_TO_SHOW, type ManifestFormatter } from './types.ts';
import { extractDocsSummary } from './extract-docs-summary.ts';
import { dedent } from '../dedent.ts';
import { parseReactDocgen } from '../parse-react-docgen.ts';

/**
 * XML formatter for component manifests.
 * Formats component data into XML structure with tags like <component>, <props>, etc.
 */
export const xmlFormatter: ManifestFormatter = {
	formatComponentManifest(componentManifest) {
		const parts: string[] = [];

		// Component opening tag
		parts.push(dedent`<component>
			<id>${componentManifest.id}</id>
			<name>${componentManifest.name}</name>`);

		// Description section
		if (componentManifest.description) {
			parts.push(dedent`<description>
				${componentManifest.description}
				</description>`);
		}

		// Stories section - only if there are stories
		if (componentManifest.stories && componentManifest.stories.length > 0) {
			const storiesWithSnippets = componentManifest.stories.filter((s) => s.snippet);
			const storiesToShow = storiesWithSnippets.slice(0, MAX_STORIES_TO_SHOW);
			const remainingStories = storiesWithSnippets.slice(MAX_STORIES_TO_SHOW);

			// Show first X stories in full detail
			for (const story of storiesToShow) {
				const storyParts: string[] = [];
				// Convert PascalCase to Human Readable Case
				// "WithSizes" -> "With Sizes"
				storyParts.push(dedent`<story>
					<story_name>${story.name.replace(/([A-Z])/g, ' $1').trim()}</story_name>`);

				if (story.description) {
					storyParts.push(dedent`<story_description>
						${story.description}
						</story_description>`);
				}

				storyParts.push('<story_code>');
				if (componentManifest.import) {
					storyParts.push(`${componentManifest.import}\n`);
				}
				storyParts.push(dedent`${story.snippet}
					</story_code>
					</story>`);

				parts.push(storyParts.join('\n'));
			}

			// Show remaining stories as names only
			if (remainingStories.length > 0) {
				parts.push('<other_stories>');
				for (const story of remainingStories) {
					const storyName = story.name.replace(/([A-Z])/g, ' $1').trim();
					parts.push(dedent`<story_name>${storyName}</story_name>`);
				}
				parts.push('</other_stories>');
			}
		}

		if (componentManifest.reactDocgen) {
			const parsedDocgen = parseReactDocgen(componentManifest.reactDocgen);
			const propEntries = Object.entries(parsedDocgen.props);

			if (propEntries.length > 0) {
				parts.push('<props>');
				for (const [propName, propInfo] of propEntries) {
					parts.push(dedent`<prop>
						<prop_name>${propName}</prop_name>`);

					if (propInfo.description !== undefined) {
						parts.push(dedent`<prop_description>
							${propInfo.description}
							</prop_description>`);
					}

					if (propInfo.type !== undefined) {
						parts.push(dedent`<prop_type>${propInfo.type}</prop_type>`);
					}

					if (propInfo.required !== undefined) {
						parts.push(dedent`<prop_required>${propInfo.required}</prop_required>`);
					}

					if (propInfo.defaultValue !== undefined) {
						parts.push(dedent`<prop_default>${propInfo.defaultValue}</prop_default>`);
					}

					parts.push('</prop>');
				}
				parts.push('</props>');
			}
		}

		parts.push('</component>');

		return parts.join('\n');
	},

	formatDocsManifest(doc) {
		return dedent`<doc>
			<title>${doc.title}</title>
			<content>
			${doc.content}
			</content>
			</doc>`;
	},

	formatManifestsToLists(manifests) {
		const parts: string[] = [];

		parts.push('<components>');

		for (const component of Object.values(manifests.componentManifest.components)) {
			parts.push(dedent`<component>
				<id>${component.id}</id>
				<name>${component.name}</name>`);

			const summary =
				component.summary ??
				(component.description
					? component.description.length > MAX_SUMMARY_LENGTH
						? `${component.description.slice(0, MAX_SUMMARY_LENGTH)}...`
						: component.description
					: undefined);

			if (summary) {
				parts.push(dedent`<summary>
					${summary}
					</summary>`);
			}

			parts.push('</component>');
		}

		parts.push('</components>');

		if (!manifests.docsManifest) {
			return parts.join('\n');
		}

		parts.push('<docs>');

		for (const doc of Object.values(manifests.docsManifest.docs)) {
			const summary = doc.summary ?? extractDocsSummary(doc.content);
			parts.push(dedent`<doc>
				<id>${doc.id}</id>
				<title>${doc.title}</title>`);

			if (summary) {
				parts.push(dedent`<summary>
					${summary}
					</summary>`);
			}

			parts.push('</doc>');
		}

		parts.push('</docs>');

		return parts.join('\n');
	},

	formatStoryDocumentation(componentManifest, storyName) {
		const story = componentManifest.stories?.find((s) => s.name === storyName);

		if (!story || !story.snippet) {
			return '';
		}

		const parts: string[] = [];

		// Convert PascalCase to Human Readable Case
		const displayStoryName = story.name.replace(/([A-Z])/g, ' $1').trim();

		parts.push(dedent`<story_documentation>
			<component_name>${componentManifest.name}</component_name>
			<story_name>${displayStoryName}</story_name>`);

		if (story.description) {
			parts.push(dedent`<story_description>
				${story.description}
				</story_description>`);
		}

		parts.push('<story_code>');
		if (componentManifest.import) {
			parts.push(`${componentManifest.import}\n`);
		}
		parts.push(dedent`${story.snippet}
			</story_code>
			</story_documentation>`);

		return parts.join('\n');
	},
};
