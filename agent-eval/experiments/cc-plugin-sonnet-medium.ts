import type { ExperimentConfig } from '@vercel/agent-eval';
import { DEFAULT_EXPERIMENT_CONFIG, EXTRA_MODEL_EVALS } from '../lib/experiment.ts';
import {
	setupSandbox,
	writeClaudePluginSkills,
	writeClaudePreviewBrowserMock,
} from '../lib/templates.ts';

export default {
	...DEFAULT_EXPERIMENT_CONFIG,
	agent: 'vercel-ai-gateway/claude-code', // requires AI_GATEWAY_API_KEY
	model: 'sonnet',
	agentOptions: { effort: 'medium' },
	// Runs zero evals unless EVAL_EXTRA_MODELS=1 is set; see EXTRA_MODEL_EVALS.
	evals: EXTRA_MODEL_EVALS,
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'claude-code', integration: 'plugin' });
		await writeClaudePluginSkills(sandbox);
		await writeClaudePreviewBrowserMock(sandbox);
	},
} satisfies ExperimentConfig;
