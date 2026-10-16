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

const model = 'gpt-6-luna?reasoningEffort=low';

export default {
  ...DEFAULT_EXPERIMENT_CONFIG,
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
