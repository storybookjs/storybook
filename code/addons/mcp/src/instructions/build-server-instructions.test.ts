import { describe, it, expect } from 'vitest';
import { buildServerInstructions } from './build-server-instructions.ts';

describe('buildServerInstructions', () => {
	it('builds a coherent instruction set when all toolsets are enabled', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: true,
			docsEnabled: true,
		});

		expect(instructions).toMatchInlineSnapshot(`
			"Follow these workflows when working with UI and/or Storybook.

			## UI Building and Story Writing Workflow

			- Before creating or editing components or stories, call **get-storybook-story-instructions**.
			- Treat that tool's output as the source of truth for framework-specific imports, story patterns, and testing conventions.
			- Before and after changing UI, call **get-changed-stories** to discover new/modified/related stories.
			- Then call **preview-stories** with selected \`storyId\` values from **get-changed-stories** to retrieve preview URLs.
			- Always include every returned preview URL in your user-facing response so the user can verify the visual result.

			## Validation Workflow

			- After each component or story change, run **run-story-tests**.
			- Use focused runs while iterating, then run a broad pass before final handoff when scope is unclear or wide.
			- Fix failing tests before reporting success. Do not report completion while story tests are failing.

			## Documentation Workflow

			1. Call **list-all-documentation** once at the start of the task to discover available component and docs IDs.
			2. Call **get-documentation** with an \`id\` from that list to retrieve full component docs, props, usage examples, and stories.
			3. Call **get-documentation-for-story** when you need additional docs from a specific story variant that was not included in the initial component documentation.

			Use \`withStoryIds: true\` on **list-all-documentation** when you also need story IDs for inputs to other tools.

			## Verification Rules

			- Never assume component props, variants, or API shape. Retrieve documentation before using a component.
			- If a component or prop is not documented, do not invent it. Report that it was not found.
			- Only reference IDs returned by **list-all-documentation**. Do not guess IDs.

			## Multi-Source Requests

			- When multiple Storybook sources are configured, **list-all-documentation** returns entries from all sources.
			- Use \`storybookId\` in **get-documentation** when you need to scope a request to one source."
		`);
	});

	it('builds a coherent instruction set for dev only', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: false,
			docsEnabled: false,
		});

		expect(instructions).toMatchInlineSnapshot(`
			"Follow these workflows when working with UI and/or Storybook.

			## UI Building and Story Writing Workflow

			- Before creating or editing components or stories, call **get-storybook-story-instructions**.
			- Treat that tool's output as the source of truth for framework-specific imports, story patterns, and testing conventions.
			- Before and after changing UI, call **get-changed-stories** to discover new/modified/related stories.
			- Then call **preview-stories** with selected \`storyId\` values from **get-changed-stories** to retrieve preview URLs.
			- Always include every returned preview URL in your user-facing response so the user can verify the visual result."
		`);
	});

	it('builds a coherent instruction set for docs only', () => {
		const instructions = buildServerInstructions({
			devEnabled: false,
			testEnabled: false,
			docsEnabled: true,
		});

		expect(instructions).toMatchInlineSnapshot(`
			"Follow these workflows when working with UI and/or Storybook.

			## Documentation Workflow

			1. Call **list-all-documentation** once at the start of the task to discover available component and docs IDs.
			2. Call **get-documentation** with an \`id\` from that list to retrieve full component docs, props, usage examples, and stories.
			3. Call **get-documentation-for-story** when you need additional docs from a specific story variant that was not included in the initial component documentation.

			Use \`withStoryIds: true\` on **list-all-documentation** when you also need story IDs for inputs to other tools.

			## Verification Rules

			- Never assume component props, variants, or API shape. Retrieve documentation before using a component.
			- If a component or prop is not documented, do not invent it. Report that it was not found.
			- Only reference IDs returned by **list-all-documentation**. Do not guess IDs.

			## Multi-Source Requests

			- When multiple Storybook sources are configured, **list-all-documentation** returns entries from all sources.
			- Use \`storybookId\` in **get-documentation** when you need to scope a request to one source."
		`);
	});

	it('builds a coherent instruction set for test only', () => {
		const instructions = buildServerInstructions({
			devEnabled: false,
			testEnabled: true,
			docsEnabled: false,
		});

		expect(instructions).toMatchInlineSnapshot(`
			"Follow these workflows when working with UI and/or Storybook.

			## Validation Workflow

			- After each component or story change, run **run-story-tests**.
			- Use focused runs while iterating, then run a broad pass before final handoff when scope is unclear or wide.
			- Fix failing tests before reporting success. Do not report completion while story tests are failing."
		`);
	});

	it('returns empty instructions when all toolsets are disabled', () => {
		const instructions = buildServerInstructions({
			devEnabled: false,
			testEnabled: false,
			docsEnabled: false,
		});

		expect(instructions).toBe('');
	});
});
