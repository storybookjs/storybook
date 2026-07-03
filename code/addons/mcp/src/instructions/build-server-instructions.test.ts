import { describe, it, expect } from 'vitest';
import { buildServerInstructions } from './build-server-instructions.ts';

// Claude Code hard-truncates MCP server instructions at 2,048 characters:
// anything past the limit silently never reaches the model. Between
// addon-mcp 0.6.0 and 0.7.x the instructions grew to ~8.7k chars, which cut
// off the Validation and Documentation workflows entirely — agents stopped
// using the docs tools. Details must live in tool descriptions and tool
// results, which are never truncated; the server instructions only carry the
// workflow triggers.
const MCP_CLIENT_INSTRUCTIONS_CHAR_LIMIT = 2048;

describe('buildServerInstructions', () => {
	it('stays under the MCP client truncation limit in every configuration', () => {
		const bools = [true, false] as const;
		for (const devEnabled of bools)
			for (const testEnabled of bools)
				for (const docsEnabled of bools)
					for (const changeDetectionEnabled of bools)
						for (const moduleGraphSupported of bools)
							for (const reviewEnabled of bools) {
								const options = {
									devEnabled,
									testEnabled,
									docsEnabled,
									changeDetectionEnabled,
									moduleGraphSupported,
									reviewEnabled,
								};
								const length = buildServerInstructions(options).length;
								expect
									.soft(length, `instructions exceed the limit for ${JSON.stringify(options)}`)
									.toBeLessThanOrEqual(MCP_CLIENT_INSTRUCTIONS_CHAR_LIMIT);
							}
	});

	it('builds a coherent instruction set when all toolsets are enabled', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: true,
			docsEnabled: true,
			changeDetectionEnabled: true,
			reviewEnabled: true,
		});

		expect(instructions).toMatchInlineSnapshot(`
			"Follow these workflows when working with UI and/or Storybook.

			## UI Building and Story Writing Workflow

			- Before creating or editing components or stories, call **get-storybook-story-instructions**; its output is the source of truth for imports, story patterns, and testing conventions.
			- After changing any component or story, call **get-changed-stories** to discover the stories affected by your change.
			- End your final response with the review section from **display-review**'s result — never substitute preview URLs for it. **preview-stories** is only for iterating on a specific story or a requested direct link. If nothing visually changed, say so plainly.
			- After a visually observable UI change, or when the user asks to see or browse stories/components, call **display-review** (again on each iteration) and follow its description and result. Visual work is not done until the review is published; any newly created story MUST be included.
			- Only use story IDs returned by tools — never derive them from file names, titles, or memory. **get-stories-by-component** maps any input (edited files, a feature name) to stories; its description covers the workflow. No matches means no stories exist yet — say so rather than fabricating IDs.

			## Validation Workflow

			- After each component or story change, run **run-story-tests**; focused runs while iterating, a broad pass before final handoff.
			- Never report completion while story tests are failing.

			## Documentation Workflow

			Never assume component props, variants, or API shape, and don't read a library's sources or types out of node_modules to learn a component — retrieve its documentation instead; never invent what isn't documented.

			1. Call **list-all-documentation** once at the start of the task to discover component and docs IDs.
			2. Call **get-documentation** with an \`id\` from that list for props and usage examples.
			3. Call **get-documentation-for-story** for more examples from a specific story variant.

			Only reference IDs returned by these tools — never guess IDs."
		`);
	});

	it('builds a coherent instruction set for dev only', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: false,
			docsEnabled: false,
			changeDetectionEnabled: true,
			reviewEnabled: true,
		});

		expect(instructions).toMatchInlineSnapshot(`
			"Follow these workflows when working with UI and/or Storybook.

			## UI Building and Story Writing Workflow

			- Before creating or editing components or stories, call **get-storybook-story-instructions**; its output is the source of truth for imports, story patterns, and testing conventions.
			- After changing any component or story, call **get-changed-stories** to discover the stories affected by your change.
			- End your final response with the review section from **display-review**'s result — never substitute preview URLs for it. **preview-stories** is only for iterating on a specific story or a requested direct link. If nothing visually changed, say so plainly.
			- After a visually observable UI change, or when the user asks to see or browse stories/components, call **display-review** (again on each iteration) and follow its description and result. Visual work is not done until the review is published; any newly created story MUST be included.
			- Only use story IDs returned by tools — never derive them from file names, titles, or memory. **get-stories-by-component** maps any input (edited files, a feature name) to stories; its description covers the workflow. No matches means no stories exist yet — say so rather than fabricating IDs."
		`);
	});

	it('omits get-changed-stories step when change detection is disabled', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: false,
			docsEnabled: false,
			changeDetectionEnabled: false,
		});

		expect(instructions).toMatchInlineSnapshot(`
			"Follow these workflows when working with UI and/or Storybook.

			## UI Building and Story Writing Workflow

			- Before creating or editing components or stories, call **get-storybook-story-instructions**; its output is the source of truth for imports, story patterns, and testing conventions.
			- After changing any component or story, call **preview-stories** to retrieve preview URLs.
			- In your final user-facing response, include every returned preview URL so the user can verify the visual result.
			- Only use story IDs returned by tools — never derive them from file names, titles, or memory. **get-stories-by-component** maps any input (edited files, a feature name) to stories; its description covers the workflow. No matches means no stories exist yet — say so rather than fabricating IDs."
		`);
	});

	it('falls back to get-stories-by-component when change detection is off but the dependency graph is available', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: false,
			docsEnabled: false,
			changeDetectionEnabled: false,
			moduleGraphSupported: true,
		});

		// The status-store-driven get-changed-stories isn't registered, but the reverse
		// dependency graph is — so the workflow should route the agent through
		// get-stories-by-component rather than the bare preview-stories line.
		expect(instructions).toContain(
			'- After changing any component or story, call **get-stories-by-component** with the files you touched, then **preview-stories** for their preview URLs.',
		);
		expect(instructions).not.toContain('call **get-changed-stories**');
	});

	it('feeds get-stories-by-component into the review when only the dependency graph is available', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: false,
			docsEnabled: false,
			changeDetectionEnabled: false,
			moduleGraphSupported: true,
			reviewEnabled: true,
		});

		// With review enabled the after-change step must not end in
		// preview-stories — discovery feeds display-review instead.
		expect(instructions).toContain(
			'- After changing any component or story, call **get-stories-by-component** with the files you touched.',
		);
		expect(instructions).not.toContain('then **preview-stories** for their preview URLs');
		expect(instructions).toContain('**preview-stories** is only for iterating on a specific story');
	});

	it('keeps the after-change step discovery-first when review is on without discovery tools', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: false,
			docsEnabled: false,
			changeDetectionEnabled: false,
			moduleGraphSupported: false,
			reviewEnabled: true,
		});

		expect(instructions).toContain(
			'- After changing any component or story, identify the stories affected by your change.',
		);
		expect(instructions).not.toContain('call **preview-stories** to retrieve preview URLs');
	});

	it('omits display-review step when reviewEnabled is false even with change detection on', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: false,
			docsEnabled: false,
			changeDetectionEnabled: true,
			reviewEnabled: false,
		});

		expect(instructions).toMatchInlineSnapshot(`
			"Follow these workflows when working with UI and/or Storybook.

			## UI Building and Story Writing Workflow

			- Before creating or editing components or stories, call **get-storybook-story-instructions**; its output is the source of truth for imports, story patterns, and testing conventions.
			- After changing any component or story, call **get-changed-stories**, then **preview-stories** for their preview URLs.
			- In your final user-facing response, include every returned preview URL so the user can verify the visual result.
			- Only use story IDs returned by tools — never derive them from file names, titles, or memory. **get-stories-by-component** maps any input (edited files, a feature name) to stories; its description covers the workflow. No matches means no stories exist yet — say so rather than fabricating IDs."
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

			Never assume component props, variants, or API shape, and don't read a library's sources or types out of node_modules to learn a component — retrieve its documentation instead; never invent what isn't documented.

			1. Call **list-all-documentation** once at the start of the task to discover component and docs IDs.
			2. Call **get-documentation** with an \`id\` from that list for props and usage examples.
			3. Call **get-documentation-for-story** for more examples from a specific story variant.

			Only reference IDs returned by these tools — never guess IDs."
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

			- After each component or story change, run **run-story-tests**; focused runs while iterating, a broad pass before final handoff.
			- Never report completion while story tests are failing."
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
