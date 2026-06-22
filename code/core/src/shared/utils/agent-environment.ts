type AgentEnvironment = {
  AI_AGENT?: string;
  CLAUDE_AGENT_SDK_VERSION?: string;
};

export function isClaudePreviewLaunch(env: AgentEnvironment = process.env) {
  return !!env.CLAUDE_AGENT_SDK_VERSION && !env.AI_AGENT;
}
