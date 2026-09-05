// Shared experiment shape for agentic-reference evals. A case's agent support
// is whatever its options declare: the design-system Storybook MCP — served
// locally from a pkg.pr.new preview package (`storybookMcpPackage`) or at an
// external URL (`storybookMcpUrl`) — other MCP servers (`mcpServers`), skills
// (`skillDirs`), a prompt transform (`editPrompt`) — or nothing at all,
// the bare control. Gated behind EVAL_AGENTIC_REFERENCE=1 — which only
// scripts/run-agentic-ref.ts sets — so the default matrix never spends on it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  ExperimentConfig,
  RunCompleteContext,
  RunCompleteHook,
  Sandbox,
} from '@vercel/agent-eval';
import { DEFAULT_EXPERIMENT_CONFIG } from '../experiment.ts';
import {
  type EvalAgent,
  type EvalIntegration,
  type McpServerSpec,
  installSkillDir,
  registerMcpServer,
  setupSandbox,
} from '../templates.ts';
import {
  type ExternalRepoPin,
  parseExternalRepoFromManifest,
  setupExternalRepo,
} from './external-repo.ts';
import { registerExternalStorybookMcp } from './external-mcp.ts';
import {
  type StorybookMcpPackageSpec,
  resolveStorybookMcpPackage,
  setupLocalStorybookMcp,
} from './local-mcp.ts';
import { postAnalysis } from './post-analysis.ts';
import { parsePositiveInteger } from './selection.ts';

import type { PostAnalysisExperiment } from '../post-analysis/types.ts';

const AGENTIC_REF_DEFAULT_RUN_COUNT = 10;

interface AgenticRefExperimentOptions {
  /** Case name; recorded in `result.analysis.case` for the offline analyzer. */
  name: string;
  evals: string[];
  /** Coding agent to evaluate. Default 'claude-code'. */
  agent?: EvalAgent;
  /** Present = run with the design-system Storybook MCP registered at this URL. */
  storybookMcpUrl?: string;
  /**
   * Present = serve the design-system Storybook MCP locally in the sandbox from
   * this pkg.pr.new preview package. Mutually exclusive with storybookMcpUrl.
   */
  storybookMcpPackage?: StorybookMcpPackageSpec;
  /**
   * Sandbox flavor recorded in the agent context: Storybook tooling only.
   * Defaults to 'mcp' with a storybookMcpUrl or storybookMcpPackage, bare
   * ('none') without — mcpServers and skillDirs deliberately do not affect it,
   * since they carry non-Storybook support.
   */
  integration?: EvalIntegration;
  /** Additional MCP servers to register, e.g. a component library's own server. */
  mcpServers?: Record<string, McpServerSpec>;
  /** Skill directories (relative to agent-eval/) installed into the agent's skills root. */
  skillDirs?: string[];
  /**
   * Rewrites each eval's PROMPT.md before the agent runs (the runner's
   * `editPrompt`), e.g. to append a docs pointer.
   */
  editPrompt?: (prompt: string) => string;
  overrides?: Partial<ExperimentConfig & PostAnalysisExperiment>;
}

// Both agents run against their provider's API directly, not the AI Gateway:
// the gateway's Codex path mis-handles its Responses tool shape, and its BYOK
// failover silently retries failed Anthropic calls on Vercel's paid pool.
// Codex folds effort into the model id; Claude Code takes a separate option.
type AgentConfig = Pick<ExperimentConfig, 'agent' | 'model'> &
  Partial<Pick<ExperimentConfig, 'agentOptions'>>;

export const AGENT_CONFIG: Record<EvalAgent, AgentConfig> = {
  'claude-code': {
    agent: 'claude-code',
    model: 'opus',
    agentOptions: { effort: 'high' },
  },
  codex: {
    agent: 'codex',
    model: 'gpt-5.5?reasoningEffort=medium',
  },
};

/** How a run's LLM traffic was served: through the AI Gateway, or a direct API. */
export type LlmProvider = 'ai-gateway' | 'anthropic' | 'openai';

/**
 * The provider a harness agent id resolves to. Gateway-served and direct-served
 * runs are not cost-comparable — the gateway's BYOK failover silently re-bills
 * retried calls and breaks prompt-cache reuse — so every run records which one
 * served it.
 */
export function providerOf(agentId: string): LlmProvider {
  if (agentId.startsWith('vercel-ai-gateway/')) {
    return 'ai-gateway';
  }
  return agentId === 'codex' ? 'openai' : 'anthropic';
}

/** Research sample size, from --runs (AGENTIC_REF_RUNS). */
function resolveRuns(): number {
  return (
    parsePositiveInteger('AGENTIC_REF_RUNS', process.env.AGENTIC_REF_RUNS) ??
    AGENTIC_REF_DEFAULT_RUN_COUNT
  );
}

// Snapshot the fixture's external-repo pin at execution time. The offline
// analyzer compares each run against the ref it actually ran on; without this it
// would have to assume the fixture's pin as it stands today, which retroactively
// changes `before`/`delta` for every historical run whenever the pin moves.
function readExternalRepoPin(fixturePath: string): ExternalRepoPin | null {
  try {
    return parseExternalRepoFromManifest(readFileSync(join(fixturePath, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

// The case record persisted into `result.analysis.case`: everything the
// offline analyzer needs to group runs by treatment. Names, paths, and flags
// only — file contents already live in the sandbox snapshot, and the prompt
// the agent actually received in the run transcript.
interface AgenticRefCaseRecord {
  name: string;
  integration: EvalIntegration;
  storybookMcpUrl?: string;
  /** The package spec plus the sha its branch resolved to for this experiment. */
  storybookMcpPackage?: StorybookMcpPackageSpec & { sha: string | null };
  mcpServers?: string[];
  skillDirs?: string[];
  /** Present (true) when the case rewrote each eval's prompt before the run. */
  editPrompt?: boolean;
}

// Compose the shared usage hook with the case record so neither clobbers the
// other (a bare override would drop token usage). Heavy metrics, including MCP
// tool usage, are computed offline — see scripts/analyze-results.ts.
function makeAgenticRefMetricsHook(agenticRefCase: AgenticRefCaseRecord, provider: LlmProvider) {
  return function attachAgenticRefMetrics(context: RunCompleteContext) {
    const withUsage = DEFAULT_EXPERIMENT_CONFIG.onRunComplete?.(context) ?? context.runData;
    return {
      ...withUsage,
      result: {
        ...withUsage.result,
        analysis: {
          ...withUsage.result.analysis,
          provider,
          externalRepo: readExternalRepoPin(context.fixture.path),
          case: agenticRefCase,
        },
      },
    };
  };
}

export function agenticRefExperiment(
  options: AgenticRefExperimentOptions
): ExperimentConfig & PostAnalysisExperiment {
  const {
    name,
    evals,
    storybookMcpUrl,
    storybookMcpPackage,
    mcpServers,
    skillDirs,
    editPrompt,
    overrides,
  } = options;
  // Config-load guard: a case declaring both would register the same server
  // name twice, with whichever wrote last silently winning.
  if (storybookMcpUrl !== undefined && storybookMcpPackage !== undefined) {
    throw new Error(
      `agenticRefExperiment: case "${name}" sets both storybookMcpUrl and storybookMcpPackage; ` +
        'pick one design-system MCP source.'
    );
  }
  const agent = options.agent ?? 'claude-code';
  const integration =
    options.integration ?? (storybookMcpUrl || storybookMcpPackage ? 'mcp' : 'none');

  async function setup(sandbox: Sandbox): Promise<void> {
    await setupSandbox(sandbox, { agent, integration });
    await setupExternalRepo(sandbox);
    // External repos can ship their own MCP client config (MealDrop's .mcp.json
    // points at its Storybook dev server). A bare arm must offer no MCP at all,
    // not a dormant one an agent could bring up mid-run.
    if (integration === 'none') {
      await sandbox.runCommand('rm', ['-f', '.mcp.json']);
    }
    if (storybookMcpUrl) {
      await registerExternalStorybookMcp(sandbox, storybookMcpUrl, agent);
    }
    if (storybookMcpPackage) {
      const resolved = await resolveStorybookMcpPackage(storybookMcpPackage);
      await setupLocalStorybookMcp(sandbox, resolved, agent);
    }
    for (const [serverName, spec] of Object.entries(mcpServers ?? {})) {
      await registerMcpServer(sandbox, agent, serverName, spec);
    }
    for (const skillDir of skillDirs ?? []) {
      await installSkillDir(sandbox, agent, skillDir);
    }
  }

  const caseRecord: AgenticRefCaseRecord = {
    name,
    integration,
    ...(storybookMcpUrl !== undefined && { storybookMcpUrl }),
    ...(storybookMcpPackage !== undefined && {
      storybookMcpPackage: { ...storybookMcpPackage, sha: null },
    }),
    ...(mcpServers && { mcpServers: Object.keys(mcpServers) }),
    ...(skillDirs && { skillDirs }),
    ...(editPrompt !== undefined && { editPrompt: true }),
  };

  // From the agent id that actually runs, so an override changing the agent
  // keeps the recorded provider truthful.
  const agentId = overrides?.agent ?? AGENT_CONFIG[agent].agent;
  const metricsHook = makeAgenticRefMetricsHook(caseRecord, providerOf(agentId));
  // An override may add its own hook, but the case record must always land in
  // the result — compose instead of letting the override replace the hook.
  const onRunComplete: RunCompleteHook =
    overrides?.onRunComplete === undefined
      ? metricsHook
      : (context) => {
          const withMetrics = metricsHook(context);
          return overrides.onRunComplete?.({ ...context, runData: withMetrics }) ?? withMetrics;
        };

  return {
    ...DEFAULT_EXPERIMENT_CONFIG,
    ...AGENT_CONFIG[agent],
    // Override per experiment to measure one case or prompt differently.
    postAnalysis,
    // The real dependency install outgrows the shared 900s default.
    // Some UI creation runs take longer than 1800s, and DS migration runs may
    // take significantly longer, so the timeout is purposefully exagerated.
    timeout: 10800,
    // Research, not a CI gate: complete every repetition rather than aborting
    // siblings once one passes.
    runs: resolveRuns(),
    earlyExit: false,
    evals: process.env.EVAL_AGENTIC_REFERENCE === '1' ? evals : [],
    setup,
    editPrompt,
    ...overrides,
    // In-sandbox vitest runs only the fixtures' transcript sanity gate, so a
    // dead agent surfaces as a failed run; the real measurement is offline.
    onRunComplete,
  };
}
