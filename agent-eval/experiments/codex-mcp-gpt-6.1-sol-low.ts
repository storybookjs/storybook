import type { ExperimentConfig } from '@vercel/agent-eval';
import {
  DEFAULT_EXPERIMENT_CONFIG,
  onlyWhenNamed,
  WORKFLOW_STORYBOOK_EVALS,
} from '../lib/experiment.ts';
import {
  commitSandboxBaseline,
  setupSandbox,
  writeCodexAgentsMd,
  writeCodexInAppBrowserMock,
  writeCodexMcpConfig,
} from '../lib/templates.ts';

const model = 'gpt-6.1-sol?reasoningEffort=low';

export default {
  ...DEFAULT_EXPERIMENT_CONFIG,
  // Use direct Codex for MCP evals. The AI Gateway Codex path does not reliably
  // handle Codex's Responses namespace tool shape yet:
  // https://github.com/openai/codex/issues/26234
  agent: 'codex',
  model,
  // Not in the default set: runs only when named.
  evals: onlyWhenNamed(import.meta.url, WORKFLOW_STORYBOOK_EVALS),
  setup: async (sandbox) => {
    await setupSandbox(sandbox, { agent: 'codex', integration: 'mcp', model });
    await writeCodexMcpConfig(sandbox);
    await writeCodexAgentsMd(sandbox);
    await writeCodexInAppBrowserMock(sandbox);
    await commitSandboxBaseline(sandbox);
  },
} satisfies ExperimentConfig;
