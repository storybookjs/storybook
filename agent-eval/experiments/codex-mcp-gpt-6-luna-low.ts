import type { ExperimentConfig } from '@vercel/agent-eval';
import { DEFAULT_EXPERIMENT_CONFIG, WORKFLOW_STORYBOOK_EVALS } from '../lib/experiment.ts';
import {
  commitSandboxBaseline,
  setupSandbox,
  writeCodexLunaTestRules,
  writeCodexMcpConfig,
  writeMcpAgentInstructions,
} from '../lib/templates.ts';

const model = 'gpt-6-luna?reasoningEffort=low';

export default {
  ...DEFAULT_EXPERIMENT_CONFIG,
  // Use direct Codex for MCP evals. The AI Gateway Codex path does not reliably
  // handle Codex's Responses namespace tool shape yet:
  // https://github.com/openai/codex/issues/26234
  agent: 'codex',
  model,
  evals: WORKFLOW_STORYBOOK_EVALS,
  setup: async (sandbox) => {
    await setupSandbox(sandbox, { agent: 'codex', integration: 'mcp', model });
    await writeCodexMcpConfig(sandbox);
    await writeMcpAgentInstructions(sandbox);
    await writeCodexLunaTestRules(sandbox, model);
    await commitSandboxBaseline(sandbox);
  },
} satisfies ExperimentConfig;
