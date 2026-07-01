import type { ExperimentConfig } from '@vercel/agent-eval';
import { defaultExperimentConfig } from '../lib/experiment.ts';
import { setupSandbox, writeCodexMcpConfig } from '../lib/templates.ts';

export default {
	...defaultExperimentConfig,
	// Use direct Codex for MCP evals. The AI Gateway Codex path does not reliably
	// handle Codex's Responses namespace tool shape yet:
	// https://github.com/openai/codex/issues/26234
	agent: 'codex',
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'codex', integration: 'mcp' });
		await writeCodexMcpConfig(sandbox);
	},
} satisfies ExperimentConfig;
