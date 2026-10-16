import type { ExperimentConfig } from '@vercel/agent-eval';
import {
  DEFAULT_EXPERIMENT_CONFIG,
  onlyWhenNamed,
  PLUGIN_STORYBOOK_EVALS,
} from '../lib/experiment.ts';
import {
  setupSandbox,
  writeClaudeInAppBrowserMock,
  writeClaudePluginSkills,
} from '../lib/templates.ts';

const model = 'claude-opus-5-5';

export default {
  ...DEFAULT_EXPERIMENT_CONFIG,
  agent: 'claude-code', // direct Anthropic API, requires ANTHROPIC_API_KEY
  model,
  agentOptions: { effort: 'medium' },
  // Not in the default set: runs only when named. Also skipped under EVAL_STORYBOOK_LATEST=1.
  evals: onlyWhenNamed(import.meta.url, PLUGIN_STORYBOOK_EVALS),
  setup: async (sandbox) => {
    await setupSandbox(sandbox, { agent: 'claude-code', integration: 'plugin', model });
    await writeClaudePluginSkills(sandbox);
    await writeClaudeInAppBrowserMock(sandbox);
  },
} satisfies ExperimentConfig;
