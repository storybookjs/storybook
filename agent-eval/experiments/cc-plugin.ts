import type { ExperimentConfig } from '@vercel/agent-eval';
import { CLAUDE_PLUGIN_EVALS, DEFAULT_EXPERIMENT_CONFIG } from '../lib/experiment.ts';
import {
	setupSandbox,
	usesClaudePreviewBrowserMock,
	writeClaudePluginSkills,
	writeClaudePreviewBrowserMock,
} from '../lib/templates.ts';

export default {
	...DEFAULT_EXPERIMENT_CONFIG,
	agent: 'vercel-ai-gateway/claude-code',
	evals: [...CLAUDE_PLUGIN_EVALS],
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'claude-code', integration: 'plugin' });
		await writeClaudePluginSkills(sandbox);
		if (await usesClaudePreviewBrowserMock(sandbox)) {
			await writeClaudePreviewBrowserMock(sandbox);
		}
	},
} satisfies ExperimentConfig;
