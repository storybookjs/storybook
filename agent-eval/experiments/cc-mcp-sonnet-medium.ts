import type { ExperimentConfig } from '@vercel/agent-eval';
import { DEFAULT_EXPERIMENT_CONFIG, EXTRA_MODEL_EVALS } from '../lib/experiment.ts';
import { setupSandbox, writeClaudeMcpConfig } from '../lib/templates.ts';

export default {
	...DEFAULT_EXPERIMENT_CONFIG,
	agent: 'claude-code', // direct Anthropic API, requires ANTHROPIC_API_KEY
	model: 'sonnet',
	agentOptions: { effort: 'medium' },
	// Runs zero evals unless EVAL_EXTRA_MODELS=1 is set; see EXTRA_MODEL_EVALS.
	evals: EXTRA_MODEL_EVALS,
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'claude-code', integration: 'mcp' });
		await writeClaudeMcpConfig(sandbox);
	},
} satisfies ExperimentConfig;
