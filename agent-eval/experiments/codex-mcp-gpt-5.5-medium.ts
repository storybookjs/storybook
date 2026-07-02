import type { ExperimentConfig } from '@vercel/agent-eval';
import { DEFAULT_EXPERIMENT_CONFIG, RESHAPED_STORYBOOK_EVALS } from '../lib/experiment.ts';
import { setupSandbox, writeCodexMcpConfig } from '../lib/templates.ts';

export default {
	...DEFAULT_EXPERIMENT_CONFIG,
	// Use direct Codex for MCP evals. The AI Gateway Codex path does not reliably
	// handle Codex's Responses namespace tool shape yet:
	// https://github.com/openai/codex/issues/26234
	agent: 'codex',
	// Pin the model: the Codex CLI's native default under API-key auth is
	// gpt-5.2-codex, which is deprecated (retiring July 2026). Medium is the
	// reasoning effort the adapter already defaults to when a model is pinned.
	model: 'gpt-5.5?reasoningEffort=medium',
	// No Codex credits left for now; switch back to RESHAPED_STORYBOOK_EVALS
	// once the budget allows. See storybookjs/mcp#315.
	evals: [] satisfies (typeof RESHAPED_STORYBOOK_EVALS)[number][],
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'codex', integration: 'mcp' });
		await writeCodexMcpConfig(sandbox);
	},
} satisfies ExperimentConfig;
