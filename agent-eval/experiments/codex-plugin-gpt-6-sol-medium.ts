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
  model: 'gpt-6-sol?reasoningEffort=medium',
  // Skipped under EVAL_STORYBOOK_LATEST=1; see PLUGIN_STORYBOOK_EVALS.
  evals: PLUGIN_STORYBOOK_EVALS,
  setup: async (sandbox) => {
    await setupSandbox(sandbox, { agent: 'codex', integration: 'plugin' });
    await writeCodexPluginSkills(sandbox);
    await writeCodexInAppBrowserMock(sandbox);
  },
} satisfies ExperimentConfig;
