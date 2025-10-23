import type { McpServer } from 'tmcp';
import * as v from 'valibot';
import { GET_STORY_URLS_TOOL_NAME } from './get-story-urls.ts';
import { collectTelemetry } from '../telemetry.ts';
import uiInstructionsTemplate from '../ui-building-instructions.md';
import { logger } from 'storybook/internal/node-logger';
import { errorToMCPContent } from '../utils/errors.ts';
import type { AddonContext } from '../types.ts';

export const GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME =
	'get-ui-building-instructions';

export async function addGetUIBuildingInstructionsTool(
	server: McpServer<any, AddonContext>,
) {
	server.tool(
		{
			name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
			title: 'UI Component Building Instructions',
			description: `Instructions on how to do UI component development. 
      
      ALWAYS call this tool before doing any UI/frontend/React/component development, including but not
      limited to adding or updating new components, pages, screens or layouts.`,
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
					});
				}

				const frameworkPreset = await options.presets.apply('framework');
				const framework =
					typeof frameworkPreset === 'string'
						? frameworkPreset
						: frameworkPreset?.name;
				const renderer = frameworkToRendererMap[framework!];

				const uiInstructions = uiInstructionsTemplate
					.replace('{{FRAMEWORK}}', framework)
					.replace('{{RENDERER}}', renderer ?? framework)
					.replace('{{GET_STORY_URLS_TOOL_NAME}}', GET_STORY_URLS_TOOL_NAME);

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
