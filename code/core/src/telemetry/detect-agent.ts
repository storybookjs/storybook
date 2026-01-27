export type KnownAgentName =
  | 'claude-code'
  | 'gemini-cli'
  | 'cursor'
  | 'codex'
  | 'opencode'
  | 'amp'
  | 'unknown';

export type AgentInfo = {
  name: KnownAgentName;
};

export type AgentDetection = {
  isAgent: boolean;
  agent?: AgentInfo;
};

type DetectAgentOptions = {
  stdoutIsTTY: boolean;
  env: NodeJS.ProcessEnv;
};

function detectExplicitAgent(env: NodeJS.ProcessEnv): AgentInfo | undefined {
  // Amp
  if (env.AGENT === 'amp') {
    return {
      name: 'amp',
    };
  }

  // Claude Code
  if (env.CLAUDECODE) {
    return {
      name: 'claude-code',
    };
  }

  // Gemini CLI
  if (env.GEMINI_CLI) {
    return {
      name: 'gemini-cli',
    };
  }

  // OpenAI Codex
  if (env.CODEX_SANDBOX) {
    return {
      name: 'codex',
    };
  }

  // Cursor Agent (proposed / best-effort; Cursor often sets VSCode env vars too)
  if (env.CURSOR_AGENT) {
    return {
      name: 'cursor',
    };
  }

  // Generic "AGENT" marker (unknown implementation)
  if (env.AGENT) {
    return { name: 'unknown' };
  }

  return undefined;
}

/** Detect whether Storybook CLI is likely being invoked by an AI agent. */
export const detectAgent = (options: DetectAgentOptions): AgentDetection => {
  const env = options.env;

  // 1) Explicit agent variables (strong signal; allow even in CI/TTY)
  const explicit = detectExplicitAgent(env);
  if (explicit) {
    return { isAgent: true, agent: explicit };
  }

  const stdoutIsTTY = options.stdoutIsTTY;

  // 2) Behavioral / fingerprint heuristics (exclude CI to reduce false positives)
  if (stdoutIsTTY) {
    return { isAgent: false };
  }

  const isDumbTerm = env.TERM === 'dumb';
  const hasAgentPager = env.GIT_PAGER === 'cat';

  if (isDumbTerm || hasAgentPager) {
    return { isAgent: true, agent: { name: 'unknown' } };
  }

  return { isAgent: false };
};
