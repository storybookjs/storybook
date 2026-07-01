import type { ExperimentConfig } from '@vercel/agent-eval';
import { CLAUDE_MCP_EVALS, DEFAULT_EXPERIMENT_CONFIG } from '../lib/experiment.ts';
import { setupSandbox, writeClaudeMcpConfig } from '../lib/templates.ts';

export default {
	...DEFAULT_EXPERIMENT_CONFIG,
	agent: 'claude-code', // requires ANTHROPIC_API_KEY
	evals: [...CLAUDE_MCP_EVALS],
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'claude-code', integration: 'mcp' });
		await writeClaudeMcpConfig(sandbox);
	},
} satisfies ExperimentConfig;
