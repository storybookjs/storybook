import type { ExperimentConfig } from '@vercel/agent-eval';
import { DEFAULT_EXPERIMENT_CONFIG, RESHAPED_STORYBOOK_EVALS } from '../lib/experiment.ts';
import { setupSandbox, writeCodexPluginSkills } from '../lib/templates.ts';

export default {
	...DEFAULT_EXPERIMENT_CONFIG,
	// Keep Codex plugin and MCP experiments on the same direct Codex runner.
	// The MCP variant cannot use the AI Gateway path yet:
	// https://github.com/openai/codex/issues/26234
	agent: 'codex',
	evals: [],
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'codex', integration: 'plugin' });
		await writeCodexPluginSkills(sandbox);
	},
} satisfies ExperimentConfig;
