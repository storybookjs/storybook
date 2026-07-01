import type { ExperimentConfig } from '@vercel/agent-eval';
import { DEFAULT_EXPERIMENT_CONFIG, RESHAPED_STORYBOOK_EVALS } from '../lib/experiment.ts';
import {
	setupSandbox,
	writeClaudePluginSkills,
	writeClaudePreviewBrowserMock,
} from '../lib/templates.ts';

export default {
	...DEFAULT_EXPERIMENT_CONFIG,
	agent: 'vercel-ai-gateway/claude-code', // requires AI_GATEWAY_API_KEY
	evals: RESHAPED_STORYBOOK_EVALS,
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'claude-code', integration: 'plugin' });
		await writeClaudePluginSkills(sandbox);
		await writeClaudePreviewBrowserMock(sandbox);
	},
} satisfies ExperimentConfig;
