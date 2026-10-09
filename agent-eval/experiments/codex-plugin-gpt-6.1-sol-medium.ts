import type { ExperimentConfig } from '@vercel/agent-eval';
import {
  DEFAULT_EXPERIMENT_CONFIG,
  onlyWhenNamed,
  PLUGIN_STORYBOOK_EVALS,
} from '../lib/experiment.ts';
import {
  setupSandbox,
  writeCodexInAppBrowserMock,
  writeCodexPluginSkills,
} from '../lib/templates.ts';

const model = 'gpt-6.1-sol?reasoningEffort=medium';

export default {
  ...DEFAULT_EXPERIMENT_CONFIG,
  // Keep Codex plugin and MCP experiments on the same direct Codex runner.
  // The MCP variant cannot use the AI Gateway path yet:
  // https://github.com/openai/codex/issues/26234
  agent: 'codex',
  model,
  // Not in the default set: runs only when named. Also skipped under EVAL_STORYBOOK_LATEST=1.
  evals: onlyWhenNamed(import.meta.url, PLUGIN_STORYBOOK_EVALS),
  setup: async (sandbox) => {
    await setupSandbox(sandbox, { agent: 'codex', integration: 'plugin', model });
    await writeCodexPluginSkills(sandbox);
    await writeCodexInAppBrowserMock(sandbox);
  },
} satisfies ExperimentConfig;
