import type { ExperimentConfig } from '@vercel/agent-eval';
import { RESHAPED_COMPONENT_EVALS, defaultExperimentConfig } from '../lib/experiment.ts';
import { setupSandbox, writeClaudeMcpConfig } from '../lib/templates.ts';

export default {
	...defaultExperimentConfig,
	agent: 'vercel-ai-gateway/claude-code',
	evals: [...RESHAPED_COMPONENT_EVALS],
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'claude-code', integration: 'mcp' });
		await writeClaudeMcpConfig(sandbox);
	},
} satisfies ExperimentConfig;
