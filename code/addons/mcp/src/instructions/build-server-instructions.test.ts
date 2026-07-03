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
			- Only use story IDs returned by tools — never derive them from file names, titles, or memory. **get-stories-by-component** maps any input (edited files, a feature name) to stories; its description covers the workflow. No matches means no stories exist yet — say so.

			## Validation Workflow

			- After each component or story change, run **run-story-tests**.
			- Never report completion while story tests are failing.

			## Documentation Workflow

			**CRITICAL: Never hallucinate component properties!** Undocumented props do not exist — never assume them from naming or other libraries, never read a component's types out of node_modules; retrieve its documentation instead.

			1. Call **list-all-documentation** once at task start to discover component and docs IDs.
			2. Call **get-documentation** with an \`id\` from that list for props and usage examples.
			3. Call **get-documentation-for-story** for more examples from a specific story variant.

			Only reference IDs returned by these tools — never guess; scope multi-source requests with \`storybookId\`."
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
			- Only use story IDs returned by tools — never derive them from file names, titles, or memory. **get-stories-by-component** maps any input (edited files, a feature name) to stories; its description covers the workflow. No matches means no stories exist yet — say so."
		`);
	});

	it('uses the legacy (pre-review) dev instructions when review is disabled', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: false,
			docsEnabled: false,
			changeDetectionEnabled: true,
		});

		// This must stay byte-identical to the dev section of the latest release —
		// with `experimentalReview` off (the default) users get the instruction
		// text we know works, while the review-flavored text is iterated on
		// behind the flag.
		expect(instructions).toMatchInlineSnapshot(`
			"Follow these workflows when working with UI and/or Storybook.

			## UI Building and Story Writing Workflow

			- Before creating or editing components or stories, call **get-storybook-story-instructions**.
			- Treat that tool's output as the source of truth for framework-specific imports, story patterns, and testing conventions.
			- After changing any component or story, call **preview-stories**.
			- Always include every returned preview URL in your user-facing response so the user can verify the visual result."
		`);
	});

	it('legacy dev instructions ignore the change-detection and module-graph flags', () => {
		const legacy = buildServerInstructions({
			devEnabled: true,
			testEnabled: false,
			docsEnabled: false,
		});

		for (const flags of [
			{ changeDetectionEnabled: true },
			{ changeDetectionEnabled: false, moduleGraphSupported: true },
			{ changeDetectionEnabled: true, moduleGraphSupported: true },
		]) {
			expect(
				buildServerInstructions({
					devEnabled: true,
					testEnabled: false,
					docsEnabled: false,
					reviewEnabled: false,
					...flags,
				}),
			).toBe(legacy);
		}
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

	it('keeps the default (review off) instructions under the 2,048-char client truncation limit', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: true,
			docsEnabled: true,
			changeDetectionEnabled: true,
			reviewEnabled: false,
		});

		// Some MCP clients truncate server instructions at 2,048 characters; the
		// default instruction set must always fit so nothing gets cut off.
		expect(instructions.length).toBeLessThanOrEqual(2048);
	});

	it('does not mention review or discovery tooling anywhere when review is disabled', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: true,
			docsEnabled: false,
			changeDetectionEnabled: true,
			reviewEnabled: false,
		});

		expect(instructions).not.toContain('display-review');
		expect(instructions).not.toContain('Mapping any input to story IDs');
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

			**CRITICAL: Never hallucinate component properties!** Before using ANY property on a component (even common-sounding ones like \`shadow\`), you MUST verify it is documented via these tools. If it is not documented, it does not exist — never assume props from naming conventions or other libraries; report it and check back with the user.

			1. Call **list-all-documentation** once at the start of the task to discover available component and docs IDs.
			2. Call **get-documentation** with an \`id\` from that list to retrieve full component docs, props, usage examples, and stories.
			3. Call **get-documentation-for-story** when you need additional docs from a specific story variant that was not included in the initial component documentation.

			Only use properties explicitly documented or shown in example stories — story names may not reflect property names. Only reference IDs returned by these tools; do not guess IDs.

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
