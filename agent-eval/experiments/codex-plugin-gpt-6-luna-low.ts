import type { ExperimentConfig } from '@vercel/agent-eval';
import { DEFAULT_EXPERIMENT_CONFIG, PLUGIN_STORYBOOK_EVALS } from '../lib/experiment.ts';
import {
  setupSandbox,
  writeCodexInAppBrowserMock,
  writeCodexPluginSkills,
} from '../lib/templates.ts';

const model = 'gpt-6-luna?reasoningEffort=low';

export default {
  ...DEFAULT_EXPERIMENT_CONFIG,
  agent: 'codex',
  model,
  // Skipped under EVAL_STORYBOOK_LATEST=1; see PLUGIN_STORYBOOK_EVALS.
  evals: PLUGIN_STORYBOOK_EVALS,
  setup: async (sandbox) => {
    await setupSandbox(sandbox, { agent: 'codex', integration: 'plugin', model });
    await writeCodexPluginSkills(sandbox);
    await writeCodexInAppBrowserMock(sandbox);
  },
} satisfies ExperimentConfig;
