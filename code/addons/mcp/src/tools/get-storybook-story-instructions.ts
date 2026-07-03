import type { McpServer } from 'tmcp';
import type { Options } from 'storybook/internal/types';
import { getAddonVitestConstants } from './run-story-tests.ts';
import { collectTelemetry } from '../telemetry.ts';
import { getFinalLinksGuidance } from '../instructions/build-server-instructions.ts';
import { getReviewStatus } from '../utils/is-review-available.ts';
import storyInstructionsTemplate from '../instructions/storybook-story-instructions.md';
import storyTestingInstructionsTemplate from '../instructions/story-testing-instructions.md';
import a11yInstructionsTemplate from '../instructions/a11y-instructions.md';
import { errorToMCPContent } from '../utils/errors.ts';
import type { AddonContext } from '../types.ts';
import {
	GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
	GET_CHANGED_STORIES_TOOL_NAME,
	PREVIEW_STORIES_TOOL_NAME,
	RUN_STORY_TESTS_TOOL_NAME,
} from './tool-names.ts';

type BuildStorybookStoryInstructionsOptions = {
	toolsets?: AddonContext['toolsets'];
	a11yEnabled?: boolean;
	addonVitestAvailable?: boolean;
};

export async function addGetUIBuildingInstructionsTool(
	server: McpServer<any, AddonContext>,
	enabled: Parameters<McpServer<any, AddonContext>['tool']>[0]['enabled'] = () =>
		server.ctx.custom?.toolsets?.dev ?? true,
) {
	const addonVitestAvailable = !!(await getAddonVitestConstants());

	server.tool(
		{
			name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
			title: 'Storybook Story Development Instructions',
			get description() {
				const testToolsetAvailable =
					(server.ctx.custom?.toolsets?.test ?? true) && addonVitestAvailable;
				const a11yAvailable = testToolsetAvailable && (server.ctx.custom?.a11yEnabled ?? false);

				return getStorybookStoryInstructionsDescription({
					testToolsetAvailable,
					a11yAvailable,
				});
			},
			enabled,
		},
		async () => {
			try {
				const { options, disableTelemetry } = server.ctx.custom ?? {};
				if (!options) {
					throw new Error('Options are required in addon context');
				}

				if (!disableTelemetry) {
					await collectTelemetry({
						event: 'tool:getUIBuildingInstructions',
						server,
						toolset: 'dev',
					});
				}

				const uiInstructions = await buildStorybookStoryInstructions(options, {
					toolsets: server.ctx.custom?.toolsets,
					a11yEnabled: server.ctx.custom?.a11yEnabled,
					addonVitestAvailable,
				});

				return {
					content: [{ type: 'text' as const, text: uiInstructions }],
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}

export function getStorybookStoryInstructionsDescription({
	testToolsetAvailable,
	a11yAvailable,
}: {
	testToolsetAvailable: boolean;
	a11yAvailable: boolean;
}) {
	const criticalTestBullets = testToolsetAvailable
		? `
- Running story tests or fixing test failures`
		: '';
	const criticalA11yBullets = a11yAvailable
		? `
- Handling accessibility (a11y) violations in stories (fix semantic issues directly; ask before visual/design changes)`
		: '';

	const testAndA11yGuidance = testToolsetAvailable
		? `
- How to handle test failures${a11yAvailable ? ' and accessibility violations' : ''}`
		: '';

	return `Get comprehensive instructions for writing, testing, and fixing Storybook stories (.stories.tsx, .stories.ts, .stories.jsx, .stories.js, .stories.svelte, .stories.vue files).

CRITICAL: You MUST call this tool before:
- Creating new Storybook stories or story files
- Updating or modifying existing Storybook stories
- Adding new story variants or exports to story files
- Editing any file matching *.stories.* patterns
- Writing components that will need stories${criticalTestBullets}${criticalA11yBullets}

This tool provides essential Storybook-specific guidance including:
- How to structure stories correctly for Storybook 9
- Required imports (Meta, StoryObj from framework package)
- Test utility imports (from 'storybook/test')
- Story naming conventions and best practices
- Play function patterns for interactive testing
- Mocking strategies for external dependencies
- Story variants and coverage requirements${testAndA11yGuidance}

Even if you're familiar with Storybook, call this tool to ensure you're following the correct patterns, import paths, and conventions for this specific Storybook setup.`;
}

export function getStorybookStoryInstructionsToolMetadata(options: {
	testToolsetAvailable: boolean;
	a11yAvailable: boolean;
}) {
	return {
		name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
		title: 'Storybook Story Development Instructions',
		description: getStorybookStoryInstructionsDescription(options),
	};
}

export async function buildStorybookStoryInstructions(
	options: Options,
	{
		toolsets,
		a11yEnabled = false,
		addonVitestAvailable,
	}: BuildStorybookStoryInstructionsOptions = {},
): Promise<string> {
	const frameworkPreset = await options.presets.apply('framework');
	const featuresPreset = await options.presets.apply('features', {});
	const changeDetectionEnabled = featuresPreset?.changeDetection ?? false;
	const reviewStatus = await getReviewStatus(options, { features: featuresPreset });
	const reviewEnabled = reviewStatus.available;
	const framework = typeof frameworkPreset === 'string' ? frameworkPreset : frameworkPreset?.name;
	const renderer = frameworkToRendererMap[framework!];
	// Mirrors the Mode A rewrite in build-server-instructions.ts: discovery
	// feeds the review, not the preview list. This tool's output is the only
	// workflow guidance plugin-path agents receive (they never see the MCP
	// server instructions), so the story-ID discipline must be stated here —
	// agents were observed constructing IDs from file names and publishing
	// reviews without any discovery call.
	const storyLinkingWorkflow = changeDetectionEnabled
		? reviewEnabled
			? `After changing any component or story, call \`${GET_CHANGED_STORIES_TOOL_NAME}\` to discover the new, modified, and related stories affected by your change. Story IDs must come from that call (or a fallback discovery tool such as get-stories-by-component for shared-infrastructure changes) — never construct them from file names, export names, or memory. Feed the discovered IDs into **display-review** when the change is visually observable; use \`${PREVIEW_STORIES_TOOL_NAME}\` only while iterating on a specific story.`
			: `After changing UI, call \`${GET_CHANGED_STORIES_TOOL_NAME}\` first, then use \`${PREVIEW_STORIES_TOOL_NAME}\` with selected \`storyId\` values from those results.`
		: `After changing UI, call \`${PREVIEW_STORIES_TOOL_NAME}\` and share the most relevant links for the changes.`;
	const changedStoryFallbackLinkGuidance = changeDetectionEnabled
		? `When sharing preview/story links (not when ending with a review section): if you did not pass every changed story into \`${PREVIEW_STORIES_TOOL_NAME}\`, include this Storybook fallback link so the user can view the complete changed list: \`/?statuses=affected;modified;new\`.`
		: `When sharing preview/story links (not when ending with a review section) and you passed only a subset into \`${PREVIEW_STORIES_TOOL_NAME}\`, mention that additional relevant stories may exist in Storybook.`;

	let uiInstructions = storyInstructionsTemplate
		.replace('{{FRAMEWORK}}', framework)
		.replace('{{RENDERER}}', renderer ?? framework)
		.replace('{{STORY_LINKING_WORKFLOW}}', storyLinkingWorkflow)
		.replace('{{FINAL_LINKS_GUIDANCE}}', getFinalLinksGuidance(reviewEnabled))
		.replace('{{CHANGED_STORY_FALLBACK_LINK_GUIDANCE}}', changedStoryFallbackLinkGuidance);

	const resolvedAddonVitestAvailable = addonVitestAvailable ?? !!(await getAddonVitestConstants());
	const testToolsetAvailable = (toolsets?.test ?? true) && resolvedAddonVitestAvailable;

	if (testToolsetAvailable) {
		const a11yFixSuffix = a11yEnabled ? ' (see a11y guidelines below)' : '';

		const storyTestingInstructions = storyTestingInstructionsTemplate
			.replaceAll('{{RUN_STORY_TESTS_TOOL_NAME}}', RUN_STORY_TESTS_TOOL_NAME)
			.replace('{{A11Y_FIX_SUFFIX}}', a11yFixSuffix);

		uiInstructions += `\n\n${storyTestingInstructions}`;
		if (a11yEnabled) {
			uiInstructions += `\n${a11yInstructionsTemplate}`;
		}
	}

	return uiInstructions;
}

// TODO: this is a stupid map to maintain and it's not complete, but we can't easily get the current renderer name
const frameworkToRendererMap: Record<string, string> = {
	'@storybook/react-vite': '@storybook/react',
	'@storybook/react-webpack5': '@storybook/react',
	'@storybook/nextjs': '@storybook/react',
	'@storybook/nextjs-vite': '@storybook/react',
	'@storybook/react-native-web-vite': '@storybook/react',

	'@storybook/vue3-vite': '@storybook/vue3',
	'@nuxtjs/storybook': '@storybook/vue3',

	'@storybook/angular': '@storybook/angular',

	'@storybook/svelte-vite': '@storybook/svelte',
	'@storybook/sveltekit': '@storybook/svelte',

	'@storybook/preact-vite': '@storybook/preact',

	'@storybook/web-components-vite': '@storybook/web-components',

	'@storybook/html-vite': '@storybook/html',
};
