import type { ExperimentConfig } from '@vercel/agent-eval';
import { DEFAULT_EXPERIMENT_CONFIG, PLUGIN_STORYBOOK_EVALS } from '../lib/experiment.ts';
import {
	setupSandbox,
	writeCodexInAppBrowserMock,
	writeCodexPluginSkills,
} from '../lib/templates.ts';

export default {
	...DEFAULT_EXPERIMENT_CONFIG,
	// Keep Codex plugin and MCP experiments on the same direct Codex runner.
	// The MCP variant cannot use the AI Gateway path yet:
	// https://github.com/openai/codex/issues/26234
	agent: 'codex',
	// Pin the model: the Codex CLI's native default under API-key auth is
	// gpt-5.2-codex, which is deprecated (retiring July 2026). Medium is the
	// reasoning effort the adapter already defaults to when a model is pinned.
	model: 'gpt-5.5?reasoningEffort=medium',
	// Skipped under EVAL_STORYBOOK_LATEST=1; see PLUGIN_STORYBOOK_EVALS.
	evals: PLUGIN_STORYBOOK_EVALS,
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'codex', integration: 'plugin' });
		await writeCodexPluginSkills(sandbox);
		await writeCodexInAppBrowserMock(sandbox);
	},
} satisfies ExperimentConfig;
