import type { ExperimentConfig } from '@vercel/agent-eval';
import { RESHAPED_COMPONENT_EVALS, defaultExperimentConfig } from '../lib/experiment.ts';
import { setupSandbox, writeCodexPluginSkills } from '../lib/templates.ts';

export default {
	...defaultExperimentConfig,
	// Keep Codex plugin and MCP experiments on the same direct Codex runner.
	// The MCP variant cannot use the AI Gateway path yet:
	// https://github.com/openai/codex/issues/26234
	agent: 'codex',
	evals: [...RESHAPED_COMPONENT_EVALS],
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'codex', integration: 'plugin' });
		await writeCodexPluginSkills(sandbox);
	},
} satisfies ExperimentConfig;
