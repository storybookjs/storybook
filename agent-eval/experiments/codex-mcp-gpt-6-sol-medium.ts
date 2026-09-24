import type { ExperimentConfig } from '@vercel/agent-eval';
import { DEFAULT_EXPERIMENT_CONFIG, WORKFLOW_STORYBOOK_EVALS } from '../lib/experiment.ts';
import {
  forceCodexDirectToolMode,
  setupSandbox,
  writeCodexInAppBrowserMock,
  writeCodexMcpConfig,
} from '../lib/templates.ts';

export default {
  ...DEFAULT_EXPERIMENT_CONFIG,
  // Use direct Codex for MCP evals. The AI Gateway Codex path does not reliably
  // handle Codex's Responses namespace tool shape yet:
  // https://github.com/openai/codex/issues/26234
  agent: 'codex',
  model: 'gpt-6-sol?reasoningEffort=medium',
  evals: WORKFLOW_STORYBOOK_EVALS,
  setup: async (sandbox) => {
    await setupSandbox(sandbox, { agent: 'codex', integration: 'mcp' });
    await writeCodexMcpConfig(sandbox);
    await writeCodexInAppBrowserMock(sandbox);
    await forceCodexDirectToolMode(sandbox);
  },
} satisfies ExperimentConfig;
