import type { ComponentManifest, ComponentManifestMap } from '../types.ts';
import { dedent } from './dedent.ts';

export function formatComponentManifest(
	componentManifest: ComponentManifest,
): string {
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

	// Examples section - only if there are examples
	if (componentManifest.examples && componentManifest.examples.length > 0) {
		for (const example of componentManifest.examples) {
			const exampleParts: string[] = [];
			// Convert PascalCase to Human Readable Case
			// "WithSizes" -> "With Sizes"
			exampleParts.push(dedent`<example>
				<example_name>${example.name.replace(/([A-Z])/g, ' $1').trim()}</example_name>`);

			if (example.description) {
				exampleParts.push(dedent`<example_description>
					${example.description}
					</example_description>`);
			}

			exampleParts.push('<example_code>');
			const importStatement = example.import || componentManifest.import;
			if (importStatement) {
				exampleParts.push(`${importStatement}\n`);
			}
			exampleParts.push(dedent`${example.snippet}
				</example_code>
				</example>`);

			parts.push(exampleParts.join('\n'));
		}
	}

	// TODO: props section

	parts.push('</component>');

	return parts.join('\n');
}

const MAX_SUMMARY_LENGTH = 90;

export function formatComponentManifestMapToList(
	manifest: ComponentManifestMap,
): string {
	const parts: string[] = [];

	parts.push('<components>');

	for (const component of Object.values(manifest.components)) {
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

	return parts.join('\n');
}
