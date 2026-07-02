import devInstructions from './dev-instructions.md';
import testInstructions from './test-instructions.md';
import { STORYBOOK_MCP_INSTRUCTIONS } from '@storybook/mcp';

export type BuildServerInstructionsOptions = {
	devEnabled: boolean;
	testEnabled: boolean;
	docsEnabled: boolean;
	changeDetectionEnabled?: boolean;
	/**
	 * `get-stories-by-component` is registered whenever the dev-server exposes the module
	 * graph — even if `features.changeDetection` is off and `get-changed-stories` is unavailable.
	 * When true and `changeDetectionEnabled` is false, the workflow falls back to manual lookup
	 * via `get-stories-by-component` instead of the status-store-driven `get-changed-stories`.
	 */
	moduleGraphSupported?: boolean;
	reviewEnabled?: boolean;
};

/**
 * The full rule for how the agent should present links in its final
 * user-facing response, delivered through the
 * `get-storybook-story-instructions` output. The server instructions only
 * carry a terse pointer to the same rule: MCP clients truncate server
 * instructions (Claude Code cuts them at 2,048 chars), so anything beyond
 * the workflow trigger must live in tool descriptions and tool results.
 *
 * Keyed on whether `display-review` is available in this Storybook setup.
 * When available, the guidance covers both paths: ending with a review section
 * after publishing, or falling back to preview URLs when no review was published
 * (e.g. non-visual refactors).
 */
export function getFinalLinksGuidance(reviewToolAvailable: boolean): string {
	return reviewToolAvailable
		? 'In your final user-facing response, show one set of links — never both. If you published a review with **display-review**, finish your reply with a dedicated review section as the very last thing in the output: its own top-level heading on a line by itself (for example `## 👀 Review your changes`), then a one-line explanation that the review shows the handful of stories most relevant to this change and that, because it is AI-curated, results may be inaccurate or incomplete, then on the next line the review page as a markdown link prefixed with a 👉 so it is easy to spot, using the returned `reviewUrl` (for example `👉 [Open the Storybook review page](<reviewUrl>)`). Nothing should come after this section. Never also list the individual story or preview URLs. Avoid internal jargon like "collection" or "trigger" in anything the user reads — those are terms from this tooling, not words that mean anything to them; use plain language unless the user used the term first. If you did not publish a review (e.g. a non-visual refactor, or you skipped it), include the returned preview URLs instead so the user can verify the visual result.'
		: 'In your final user-facing response, include every returned preview URL so the user can verify the visual result, ordered consistently (changed-stories fallback first if relevant, then the specific preview URLs).';
}

export function buildServerInstructions(options: BuildServerInstructionsOptions): string {
	const sections = ['Follow these workflows when working with UI and/or Storybook.'];

	if (options.devEnabled) {
		const changeDetection = options.changeDetectionEnabled ?? false;
		const graphSupported = options.moduleGraphSupported ?? false;
		const reviewEnabled = options.reviewEnabled ?? false;
		const previewStoriesStep = changeDetection
			? 'After changing any component or story, call **get-changed-stories**, then **preview-stories** for their preview URLs.'
			: graphSupported
				? 'After changing any component or story, call **get-stories-by-component** with the files you touched, then **preview-stories** for their preview URLs.'
				: 'After changing any component or story, call **preview-stories** to retrieve preview URLs.';
		// Terse pointer only: the full link-presentation rule reaches the agent
		// through the get-storybook-story-instructions output (getFinalLinksGuidance)
		// and the display-review tool result, which are never truncated.
		const finalLinksStep = reviewEnabled
			? "End your final response with one set of links, never both: the review section from **display-review**'s result, or the returned preview URLs when no review was published."
			: 'In your final user-facing response, include every returned preview URL so the user can verify the visual result.';
		sections.push(
			devInstructions
				.replace('{{PREVIEW_STORIES_STEP}}', previewStoriesStep)
				.replace('{{FINAL_LINKS_STEP}}', finalLinksStep)
				.replace(
					'{{DISPLAY_REVIEW_STEP}}',
					reviewEnabled
						? "\n- After a visually observable UI change, or when the user asks to see or browse stories/components, call **display-review** (again on each iteration) and follow its description and result. Any newly created story MUST be included in the review."
						: '',
				)
				.trim(),
		);
	}

	if (options.testEnabled) {
		sections.push(testInstructions.trim());
	}

	if (options.docsEnabled) {
		sections.push(STORYBOOK_MCP_INSTRUCTIONS.trim());
	}

	if (sections.length === 1) {
		return '';
	}

	return sections.join('\n\n');
}
