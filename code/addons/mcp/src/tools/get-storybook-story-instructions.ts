import type { McpServer } from 'tmcp';
import { getAddonVitestConstants } from './run-story-tests.ts';
import { collectTelemetry } from '../telemetry.ts';
import storyInstructionsTemplate from '../instructions/storybook-story-instructions.md';
import storyTestingInstructionsTemplate from '../instructions/story-testing-instructions.md';
import a11yInstructionsTemplate from '../instructions/a11y-instructions.md';
import { errorToMCPContent } from '../utils/errors.ts';
import type { AddonContext } from '../types.ts';
import { isAddonA11yEnabled } from '../utils/is-addon-a11y-enabled.ts';
import {
	GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
	PREVIEW_STORIES_TOOL_NAME,
	RUN_STORY_TESTS_TOOL_NAME,
} from './tool-names.ts';

export async function addGetUIBuildingInstructionsTool(server: McpServer<any, AddonContext>) {
	const addonVitestAvailable = !!(await getAddonVitestConstants());

	server.tool(
		{
			name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
			title: 'Storybook Story Development Instructions',
			get description() {
				const testToolsetAvailable =
					(server.ctx.custom?.toolsets?.test ?? true) && addonVitestAvailable;
				const a11yAvailable = testToolsetAvailable && (server.ctx.custom?.a11yEnabled ?? false);

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
			},
			enabled: () => server.ctx.custom?.toolsets?.dev ?? true,
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

				const frameworkPreset = await options.presets.apply('framework');
				const framework =
					typeof frameworkPreset === 'string' ? frameworkPreset : frameworkPreset?.name;
				const renderer = frameworkToRendererMap[framework!];

				let uiInstructions = storyInstructionsTemplate
					.replace('{{FRAMEWORK}}', framework)
					.replace('{{RENDERER}}', renderer ?? framework)
					.replace('{{PREVIEW_STORIES_TOOL_NAME}}', PREVIEW_STORIES_TOOL_NAME);

				// Conditionally append story testing instructions if test toolset is enabled and addon-vitest is available
				const testToolsetAvailable =
					(server.ctx.custom?.toolsets?.test ?? true) && !!(await getAddonVitestConstants());

				if (testToolsetAvailable) {
					const a11yEnabled = await isAddonA11yEnabled(options);
					const a11yFixSuffix = a11yEnabled ? ' (see a11y guidelines below)' : '';

					const storyTestingInstructions = storyTestingInstructionsTemplate
						.replaceAll('{{RUN_STORY_TESTS_TOOL_NAME}}', RUN_STORY_TESTS_TOOL_NAME)
						.replace('{{A11Y_FIX_SUFFIX}}', a11yFixSuffix);

					uiInstructions += `\n\n${storyTestingInstructions}`;
					if (a11yEnabled) {
						uiInstructions += `\n${a11yInstructionsTemplate}`;
					}
				}

				return {
					content: [{ type: 'text' as const, text: uiInstructions }],
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
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
