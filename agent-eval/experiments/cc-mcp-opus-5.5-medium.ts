import type { ExperimentConfig } from '@vercel/agent-eval';
import { DEFAULT_EXPERIMENT_CONFIG, WORKFLOW_STORYBOOK_EVALS } from '../lib/experiment.ts';
import {
  setupSandbox,
  writeClaudeInAppBrowserMock,
  writeClaudeMcpConfig,
} from '../lib/templates.ts';

export default {
  ...DEFAULT_EXPERIMENT_CONFIG,
  agent: 'claude-code', // direct Anthropic API, requires ANTHROPIC_API_KEY
  model: 'claude-opus-5-5',
  agentOptions: { effort: 'medium' },
  evals: WORKFLOW_STORYBOOK_EVALS,
  setup: async (sandbox) => {
    await setupSandbox(sandbox, { agent: 'claude-code', integration: 'mcp' });
    await writeClaudeMcpConfig(sandbox);
    await writeClaudeInAppBrowserMock(sandbox);
  },
} satisfies ExperimentConfig;
