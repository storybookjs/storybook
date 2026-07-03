import { describe, it, expect } from 'vitest';
import { buildServerInstructions } from './build-server-instructions.ts';

describe('buildServerInstructions', () => {
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

			- Before creating or editing components or stories, call **get-storybook-story-instructions**.
			- Treat that tool's output as the source of truth for framework-specific imports, story patterns, and testing conventions.
			- After changing any component or story, call **get-changed-stories** to discover the new, modified, and related stories affected by your change.
			- In your final user-facing response, show one set of links — never both. If you published a review with **display-review**, finish your reply with a dedicated review section as the very last thing in the output: its own top-level heading on a line by itself (for example \`## 👀 Review your changes\`), then a one-line explanation that the review shows the handful of stories most relevant to this change and that, because it is AI-curated, results may be inaccurate or incomplete, then on the next line the review page as a markdown link prefixed with a 👉 so it is easy to spot, using the returned \`reviewUrl\` (for example \`👉 [Open the Storybook review page](<reviewUrl>)\`). Nothing should come after this section. Never also list the individual story or preview URLs. Avoid internal jargon like "collection" or "trigger" in anything the user reads — those are terms from this tooling, not words that mean anything to them; use plain language unless the user used the term first. A visually observable change is not finished until its review is published — never substitute preview URLs for the review. Only when there is no review because the change has no visually observable impact, say so plainly; include preview URLs only if the user asked to see specific stories.
			- After a UI change, call **display-review** to publish a curated review — but only when the change is expected to be visually observable. Publishing that review is how you finish visual work; the change is not done without it. Pure refactors with no rendering impact (type-only edits, internal renames, dead-code removal, comment/import reorg) don't need a review; skip the call, or publish a single small collection and note in the description that no visible change is expected. When you're unsure whether a refactor has visual side-effects, publish the review and say so. Every story you created in this change must appear in the review, including interaction/play-function stories; showing the stories you modified is encouraged too — curate by grouping, never by omission. Also call **display-review** whenever the user wants to see or browse stories/components rather than change them (e.g. "show me all badge components", "what button variants do we have") — resolve the matching story IDs and render them as collections, passing \`changedFiles: []\` since no code changed. The Storybook serving these tools is already running — a successful tool call proves it. Never start another Storybook to view the review: no \`storybook dev\`, no run/launch task, no editing a launch config, no new port. Reuse the running instance at the \`reviewUrl\`'s origin; if its port looks busy, that **is** the Storybook to reuse, not a conflict to route around. If the session has any browser-preview or navigate tool, open the returned \`reviewUrl\` in your preview browser yourself — don't just print the link, actually navigate to it so the review opens in your preview window. Separately, always show the \`reviewUrl\` to the user in your final response as well, even after you've opened it yourself — they need the link too. Call this tool again whenever the user iterates on the changes.
			- Use **preview-stories** only while iterating on a specific story or when the user asks for a direct link to one — never as the ending of visual work; the review is the ending.

			## Mapping any input to story IDs

			Whenever you need story IDs — to preview them, to feed \`display-review\`, to answer the user, for any reason at all — your job is the same regardless of how the request reached you. The input can take any shape: a feature/domain/topic the user named, a file the user mentioned, a file you just edited, a query like "all consumers of X", an autonomous review after a UI change, or anything else. The chain doesn't change with the prompt shape:

			1. **Identify the relevant component file paths.** Use whatever you have — the user's words, the files you touched, the symbol that changed — and reach a list of absolute paths to component source files using filesystem search (grep / Glob / find) and code reading. The bridge from "whatever the input was" to "a list of component file paths" is yours to build; the tool starts where that bridge ends. One common trap: when the changed file is _shared_ infrastructure (theme token, design token, util, hook, CSS module) it isn't itself a component — grep for its consumers and pass _their_ paths, not the shared file's. If the symbol you greped looks like one member of a related group (sibling tokens, neighboring exports), widen to the rest of the group too — related symbols are often consumed together by different components, and a too-narrow grep silently drops stories. A subtle variant: when you've made _multiple_ edits in the same session, \`get-changed-stories\` returns the _cumulative_ diff — so a non-empty result may reflect an earlier sub-change and not cover your most recent edit. Always check that every file you've touched is represented in the response; for any that isn't, treat it as the "shared infrastructure" case and call \`get-stories-by-component\` with its consumers. The tool will surface this gap explicitly with a "coverage sanity check" hint when it detects unreachable working-tree files.
			2. **Call \`get-stories-by-component\`** with those absolute paths. It returns grounded \`storyId\` values from the live Storybook index, ranked by \`distance\` (0 = the path you passed is itself a story file, 1 = direct importer, 2+ = transitive). Title strings can be overridden by story authors and don't always match filenames — only IDs from this tool (or other discovery tools like \`list-all-documentation\`) are safe to use.
			3. **Bucket by \`distance\`.** The tool caps results at \`maxDistance: 3\` by default; lower it to tighten precision when you have a reason to, or raise it to widen recall. Shared low-level primitives and theme tokens are usually consumed through wrapper components rather than directly from any story file, so the \`distance 1\` bucket is often empty — capping at \`1\` would hide the entire cascade. Page-level components can also see surprising \`distance 3+\` matches when Storybook decorators pull in wide swaths of the app; the default cap defuses most of that without losing real consumers. For \`display-review\`, the buckets map directly onto the visual cascade: \`0\` = the component itself, \`1\` = direct importers, \`2+\` (capped via \`maxDistance\`) = page-level context — one collection per layer. When several stories of the same component share a distance, prefer the variant whose name signals it renders the changed surface.
			4. **Pass the resulting \`storyId\`s into \`preview-stories\`** for preview URLs, or into \`display-review\` for a curated review page (per the visibility guidance above — skip review for changes with no expected visual impact).

			Never invent story IDs from file names, feature names, or memory — Storybook IDs come from the live index and are the only ones that resolve. If \`get-stories-by-component\` returns no matches for a component, that component genuinely has no stories yet; tell the user rather than fabricating IDs. \`display-review\` validates every ID against the live index server-side and will hard-fail the whole review if any are unknown — there is no "soft" guess that slips through.

			## Validation Workflow

			- After editing anything that changes how the UI looks, run **run-story-tests**.
			- Use focused runs while iterating, then a broad pass before handoff when scope is unclear or wide.
			- Fix failing tests before reporting success. Do not report completion while story tests are failing.

			## Documentation Workflow

			**CRITICAL: Never hallucinate component properties!** Before using ANY property on a component (even common-sounding ones like \`shadow\`), you MUST verify it is documented via these tools. If it is not documented, it does not exist — never assume props from naming conventions or other libraries; report it to the user instead. Answer props/usage questions from these tools too — component source and type definitions are not verification.

			1. Call **list-all-documentation** once at the start of the task to discover available component and docs IDs.
			2. Call **get-documentation** with an \`id\` from that list to retrieve full component docs, props, usage examples, and stories.
			3. Call **get-documentation-for-story** for extra docs on a story variant not covered by the component docs.

			Only use properties explicitly documented or shown in example stories. Only reference IDs returned by these tools; never guess IDs.

			## Multi-Source Requests

			- With multiple sources configured, **list-all-documentation** returns entries from every source; pass \`storybookId\` to **get-documentation** to scope one."
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

			- Before creating or editing components or stories, call **get-storybook-story-instructions**.
			- Treat that tool's output as the source of truth for framework-specific imports, story patterns, and testing conventions.
			- After changing any component or story, call **get-changed-stories** to discover the new, modified, and related stories affected by your change.
			- In your final user-facing response, show one set of links — never both. If you published a review with **display-review**, finish your reply with a dedicated review section as the very last thing in the output: its own top-level heading on a line by itself (for example \`## 👀 Review your changes\`), then a one-line explanation that the review shows the handful of stories most relevant to this change and that, because it is AI-curated, results may be inaccurate or incomplete, then on the next line the review page as a markdown link prefixed with a 👉 so it is easy to spot, using the returned \`reviewUrl\` (for example \`👉 [Open the Storybook review page](<reviewUrl>)\`). Nothing should come after this section. Never also list the individual story or preview URLs. Avoid internal jargon like "collection" or "trigger" in anything the user reads — those are terms from this tooling, not words that mean anything to them; use plain language unless the user used the term first. A visually observable change is not finished until its review is published — never substitute preview URLs for the review. Only when there is no review because the change has no visually observable impact, say so plainly; include preview URLs only if the user asked to see specific stories.
			- After a UI change, call **display-review** to publish a curated review — but only when the change is expected to be visually observable. Publishing that review is how you finish visual work; the change is not done without it. Pure refactors with no rendering impact (type-only edits, internal renames, dead-code removal, comment/import reorg) don't need a review; skip the call, or publish a single small collection and note in the description that no visible change is expected. When you're unsure whether a refactor has visual side-effects, publish the review and say so. Every story you created in this change must appear in the review, including interaction/play-function stories; showing the stories you modified is encouraged too — curate by grouping, never by omission. Also call **display-review** whenever the user wants to see or browse stories/components rather than change them (e.g. "show me all badge components", "what button variants do we have") — resolve the matching story IDs and render them as collections, passing \`changedFiles: []\` since no code changed. The Storybook serving these tools is already running — a successful tool call proves it. Never start another Storybook to view the review: no \`storybook dev\`, no run/launch task, no editing a launch config, no new port. Reuse the running instance at the \`reviewUrl\`'s origin; if its port looks busy, that **is** the Storybook to reuse, not a conflict to route around. If the session has any browser-preview or navigate tool, open the returned \`reviewUrl\` in your preview browser yourself — don't just print the link, actually navigate to it so the review opens in your preview window. Separately, always show the \`reviewUrl\` to the user in your final response as well, even after you've opened it yourself — they need the link too. Call this tool again whenever the user iterates on the changes.
			- Use **preview-stories** only while iterating on a specific story or when the user asks for a direct link to one — never as the ending of visual work; the review is the ending.

			## Mapping any input to story IDs

			Whenever you need story IDs — to preview them, to feed \`display-review\`, to answer the user, for any reason at all — your job is the same regardless of how the request reached you. The input can take any shape: a feature/domain/topic the user named, a file the user mentioned, a file you just edited, a query like "all consumers of X", an autonomous review after a UI change, or anything else. The chain doesn't change with the prompt shape:

			1. **Identify the relevant component file paths.** Use whatever you have — the user's words, the files you touched, the symbol that changed — and reach a list of absolute paths to component source files using filesystem search (grep / Glob / find) and code reading. The bridge from "whatever the input was" to "a list of component file paths" is yours to build; the tool starts where that bridge ends. One common trap: when the changed file is _shared_ infrastructure (theme token, design token, util, hook, CSS module) it isn't itself a component — grep for its consumers and pass _their_ paths, not the shared file's. If the symbol you greped looks like one member of a related group (sibling tokens, neighboring exports), widen to the rest of the group too — related symbols are often consumed together by different components, and a too-narrow grep silently drops stories. A subtle variant: when you've made _multiple_ edits in the same session, \`get-changed-stories\` returns the _cumulative_ diff — so a non-empty result may reflect an earlier sub-change and not cover your most recent edit. Always check that every file you've touched is represented in the response; for any that isn't, treat it as the "shared infrastructure" case and call \`get-stories-by-component\` with its consumers. The tool will surface this gap explicitly with a "coverage sanity check" hint when it detects unreachable working-tree files.
			2. **Call \`get-stories-by-component\`** with those absolute paths. It returns grounded \`storyId\` values from the live Storybook index, ranked by \`distance\` (0 = the path you passed is itself a story file, 1 = direct importer, 2+ = transitive). Title strings can be overridden by story authors and don't always match filenames — only IDs from this tool (or other discovery tools like \`list-all-documentation\`) are safe to use.
			3. **Bucket by \`distance\`.** The tool caps results at \`maxDistance: 3\` by default; lower it to tighten precision when you have a reason to, or raise it to widen recall. Shared low-level primitives and theme tokens are usually consumed through wrapper components rather than directly from any story file, so the \`distance 1\` bucket is often empty — capping at \`1\` would hide the entire cascade. Page-level components can also see surprising \`distance 3+\` matches when Storybook decorators pull in wide swaths of the app; the default cap defuses most of that without losing real consumers. For \`display-review\`, the buckets map directly onto the visual cascade: \`0\` = the component itself, \`1\` = direct importers, \`2+\` (capped via \`maxDistance\`) = page-level context — one collection per layer. When several stories of the same component share a distance, prefer the variant whose name signals it renders the changed surface.
			4. **Pass the resulting \`storyId\`s into \`preview-stories\`** for preview URLs, or into \`display-review\` for a curated review page (per the visibility guidance above — skip review for changes with no expected visual impact).

			Never invent story IDs from file names, feature names, or memory — Storybook IDs come from the live index and are the only ones that resolve. If \`get-stories-by-component\` returns no matches for a component, that component genuinely has no stories yet; tell the user rather than fabricating IDs. \`display-review\` validates every ID against the live index server-side and will hard-fail the whole review if any are unknown — there is no "soft" guess that slips through."
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
			- Treat its output as the source of truth for imports, story patterns, and testing conventions.
			- After editing anything that changes how the UI looks — components, stories, styles, themes, colors, design tokens — call **preview-stories**, no exceptions; a shared file has no stories of its own, so preview its consumers' stories.
			- Include every returned preview URL in your final response."
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
			'- After changing any component or story, call **get-stories-by-component** with the absolute paths of the files you touched to find the stories that render them.',
		);
		expect(instructions).not.toContain('then call **preview-stories** to retrieve preview URLs');
		expect(instructions).toContain(
			'- Use **preview-stories** only while iterating on a specific story',
		);
	});

	it('routes the after-change step through the story-ID mapping when review is on without discovery tools', () => {
		const instructions = buildServerInstructions({
			devEnabled: true,
			testEnabled: false,
			docsEnabled: false,
			changeDetectionEnabled: false,
			moduleGraphSupported: false,
			reviewEnabled: true,
		});

		expect(instructions).toContain(
			'- After changing any component or story, resolve the affected story IDs (see "Mapping any input to story IDs" below).',
		);
		expect(instructions).not.toContain('then call **preview-stories** to retrieve preview URLs');
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

			**CRITICAL: Never hallucinate component properties!** Before using ANY property on a component (even common-sounding ones like \`shadow\`), you MUST verify it is documented via these tools. If it is not documented, it does not exist — never assume props from naming conventions or other libraries; report it to the user instead. Answer props/usage questions from these tools too — component source and type definitions are not verification.

			1. Call **list-all-documentation** once at the start of the task to discover available component and docs IDs.
			2. Call **get-documentation** with an \`id\` from that list to retrieve full component docs, props, usage examples, and stories.
			3. Call **get-documentation-for-story** for extra docs on a story variant not covered by the component docs.

			Only use properties explicitly documented or shown in example stories. Only reference IDs returned by these tools; never guess IDs.

			## Multi-Source Requests

			- With multiple sources configured, **list-all-documentation** returns entries from every source; pass \`storybookId\` to **get-documentation** to scope one."
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

			- After editing anything that changes how the UI looks, run **run-story-tests**.
			- Use focused runs while iterating, then a broad pass before handoff when scope is unclear or wide.
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
