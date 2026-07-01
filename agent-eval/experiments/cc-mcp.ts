import type { ExperimentConfig } from '@vercel/agent-eval';
import { DEFAULT_EXPERIMENT_CONFIG, RESHAPED_STORYBOOK_EVALS } from '../lib/experiment.ts';
import { setupSandbox, writeClaudeMcpConfig } from '../lib/templates.ts';

export default {
	...DEFAULT_EXPERIMENT_CONFIG,
	agent: 'vercel-ai-gateway/claude-code',
	evals: [...RESHAPED_STORYBOOK_EVALS],
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'claude-code', integration: 'mcp' });
		await writeClaudeMcpConfig(sandbox);
	},
} satisfies ExperimentConfig;
