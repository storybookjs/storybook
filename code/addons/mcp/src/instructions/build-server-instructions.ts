import devInstructions from './dev-instructions.md';
import testInstructions from './test-instructions.md';
import { STORYBOOK_MCP_INSTRUCTIONS } from '@storybook/mcp';

export type BuildServerInstructionsOptions = {
	devEnabled: boolean;
	testEnabled: boolean;
	docsEnabled: boolean;
	changeDetectionEnabled?: boolean;
	/**
	 * `get-stories-by-component` is registered whenever the dev-server exposes the dependency
	 * graph — even if `features.changeDetection` is off and `get-changed-stories` is unavailable.
	 * When true and `changeDetectionEnabled` is false, the workflow falls back to manual lookup
	 * via `get-stories-by-component` instead of the status-store-driven `get-changed-stories`.
	 */
	dependencyGraphSupported?: boolean;
	reviewEnabled?: boolean;
};

export function buildServerInstructions(options: BuildServerInstructionsOptions): string {
	const sections = ['Follow these workflows when working with UI and/or Storybook.'];

	if (options.devEnabled) {
		const changeDetection = options.changeDetectionEnabled ?? false;
		const graphSupported = options.dependencyGraphSupported ?? false;
		const reviewEnabled = options.reviewEnabled ?? false;
		const previewStoriesStep = changeDetection
			? 'After changing any component or story, call **get-changed-stories** to discover new/modified/related stories, then call **preview-stories** to retrieve preview URLs.'
			: graphSupported
				? 'After changing any component or story, call **get-stories-by-component** with the absolute paths of the files you touched to find the stories that render them, then call **preview-stories** to retrieve preview URLs.'
				: 'After changing any component or story, call **preview-stories** to retrieve preview URLs.';
		sections.push(
			devInstructions
				.replace('{{PREVIEW_STORIES_STEP}}', previewStoriesStep)
				.replace(
					'{{DISPLAY_REVIEW_STEP}}',
					reviewEnabled
						? "\n- After a UI change, call **display-review** to publish a curated review — but only when the change is expected to be visually observable. Pure refactors with no rendering impact (type-only edits, internal renames, dead-code removal, comment/import reorg) don't need a review; skip the call, or publish a single small collection and note in the description that no visible change is expected. When you're unsure whether a refactor has visual side-effects, publish the review and say so. Also call **display-review** whenever the user wants to see or browse stories/components rather than change them (e.g. \"show me all badge components\", \"what button variants do we have\") — resolve the matching story IDs and render them as collections, omitting `changedFiles`. The Storybook serving these tools is already running — a successful tool call proves it. Never start another Storybook to view the review: no `storybook dev`, no run/launch task, no editing a launch config, no new port. Reuse the running instance at the `reviewUrl`'s origin; if its port looks busy, that **is** the Storybook to reuse, not a conflict to route around. If the session has a browser-preview tool, navigate it to the returned `reviewUrl` so the user sees the review without leaving the chat. Always include the `reviewUrl` in your final response as a fallback. Call this tool again whenever the user iterates on the changes."
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
