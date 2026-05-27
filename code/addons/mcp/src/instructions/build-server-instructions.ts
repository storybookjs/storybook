import devInstructions from './dev-instructions.md';
import testInstructions from './test-instructions.md';
import { STORYBOOK_MCP_INSTRUCTIONS } from '@storybook/mcp';

export type BuildServerInstructionsOptions = {
	devEnabled: boolean;
	testEnabled: boolean;
	docsEnabled: boolean;
	changeDetectionEnabled?: boolean;
	reviewEnabled?: boolean;
};

export function buildServerInstructions(options: BuildServerInstructionsOptions): string {
	const sections = ['Follow these workflows when working with UI and/or Storybook.'];

	if (options.devEnabled) {
		const changeDetection = options.changeDetectionEnabled ?? false;
		const reviewEnabled = options.reviewEnabled ?? false;
		sections.push(
			devInstructions
				.replace(
					'{{PREVIEW_STORIES_STEP}}',
					changeDetection
						? 'After changing any component or story, call **get-changed-stories** to discover new/modified/related stories, then call **preview-stories** to retrieve preview URLs.'
						: 'After changing any component or story, call **preview-stories** to retrieve preview URLs.',
				)
				.replace(
					'{{DISPLAY_REVIEW_STEP}}',
					reviewEnabled
						? "\n- After completing the change, call **display-review** to publish a curated review to Storybook's review page. If the session has a browser-preview tool, navigate it to the returned `reviewUrl` so the user sees the review without leaving the chat. Always include the `reviewUrl` in your final response as a fallback."
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
