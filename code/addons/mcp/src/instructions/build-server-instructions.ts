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
 * The rule for how the agent should present links in its final user-facing
 * response. Shared between the server instructions and the
 * `get-storybook-story-instructions` output so the two can never drift apart
 * and contradict each other.
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
			? 'After changing any component or story, call **get-changed-stories** to discover new/modified/related stories, then call **preview-stories** to retrieve preview URLs.'
			: graphSupported
				? 'After changing any component or story, call **get-stories-by-component** with the absolute paths of the files you touched to find the stories that render them, then call **preview-stories** to retrieve preview URLs.'
				: 'After changing any component or story, call **preview-stories** to retrieve preview URLs.';
		// Final response shows one set of links, never both when display-review
		// is available. Shared with the story-instructions output via
		// getFinalLinksGuidance so the two can't drift apart.
		const finalLinksStep = getFinalLinksGuidance(reviewEnabled);
		sections.push(
			devInstructions
				.replace('{{PREVIEW_STORIES_STEP}}', previewStoriesStep)
				.replace('{{FINAL_LINKS_STEP}}', finalLinksStep)
				.replace(
					'{{DISPLAY_REVIEW_STEP}}',
					reviewEnabled
						? "\n- After a UI change, call **display-review** to publish a curated review — but only when the change is expected to be visually observable. Pure refactors with no rendering impact (type-only edits, internal renames, dead-code removal, comment/import reorg) don't need a review; skip the call, or publish a single small collection and note in the description that no visible change is expected. When you're unsure whether a refactor has visual side-effects, publish the review and say so. Every story you created in this change must appear in the review, including interaction/play-function stories; showing the stories you modified is encouraged too — curate by grouping, never by omission. Also call **display-review** whenever the user wants to see or browse stories/components rather than change them (e.g. \"show me all badge components\", \"what button variants do we have\") — resolve the matching story IDs and render them as collections, passing `changedFiles: []` since no code changed. The Storybook serving these tools is already running — a successful tool call proves it. Never start another Storybook to view the review: no `storybook dev`, no run/launch task, no editing a launch config, no new port. Reuse the running instance at the `reviewUrl`'s origin; if its port looks busy, that **is** the Storybook to reuse, not a conflict to route around. If the session has any browser-preview or navigate tool, open the returned `reviewUrl` in your preview browser yourself — don't just print the link, actually navigate to it so the review opens in your preview window. Separately, always show the `reviewUrl` to the user in your final response as well, even after you've opened it yourself — they need the link too. Call this tool again whenever the user iterates on the changes."
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
