import type { ExperimentConfig } from '@vercel/agent-eval';
import { CLAUDE_PLUGIN_EVALS, defaultExperimentConfig } from '../lib/experiment.ts';
import {
	setupSandbox,
	writeClaudePluginSkills,
	writeClaudePreviewBrowserMock,
} from '../lib/templates.ts';

export default {
	...defaultExperimentConfig,
	agent: 'vercel-ai-gateway/claude-code',
	evals: [...CLAUDE_PLUGIN_EVALS],
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'claude-code', integration: 'plugin' });
		await writeClaudePluginSkills(sandbox);
		await writeClaudePreviewBrowserMock(sandbox);
	},
} satisfies ExperimentConfig;
