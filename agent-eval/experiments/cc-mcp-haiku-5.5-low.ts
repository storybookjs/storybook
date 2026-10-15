import type { ExperimentConfig } from '@vercel/agent-eval';
import {
  DEFAULT_EXPERIMENT_CONFIG,
  onlyWhenNamed,
  WORKFLOW_STORYBOOK_EVALS,
} from '../lib/experiment.ts';
import {
  commitSandboxBaseline,
  setupSandbox,
  writeClaudeInAppBrowserMock,
  writeClaudeMcpConfig,
  writeMcpAgentInstructions,
} from '../lib/templates.ts';

const model = 'claude-haiku-5-5';

export default {
  ...DEFAULT_EXPERIMENT_CONFIG,
  agent: 'claude-code', // direct Anthropic API, requires ANTHROPIC_API_KEY
  model,
  agentOptions: { effort: 'low' },
  // Not in the default set: runs only when named.
  evals: onlyWhenNamed(import.meta.url, WORKFLOW_STORYBOOK_EVALS),
  setup: async (sandbox) => {
    await setupSandbox(sandbox, { agent: 'claude-code', integration: 'mcp', model });
    await writeClaudeMcpConfig(sandbox);
    await writeClaudeInAppBrowserMock(sandbox);
    await writeMcpAgentInstructions(sandbox);
    await commitSandboxBaseline(sandbox);
  },
} satisfies ExperimentConfig;
