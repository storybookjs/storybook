import { detectAgent as originalDetectAgent } from 'std-env';

/**
 * Extended agent detection that covers cases std-env misses.
 *
 * std-env (as of today) does NOT detect:
 *  - Claude Code via CLAUDE_CODE_SSE_PORT (only checks CLAUDECODE / CLAUDE_CODE)
 *  - GitHub Copilot
 *  - Cline
 *  - Windsurf
 *  - Aider
 *  - Bolt
 *  - v0
 *  - Lovable
 */
export function detectAgent() {
  // Try std-env first
  const stdResult = originalDetectAgent();
  if (stdResult.name) return stdResult;

  const env = process.env;

  const extraChecks: [string, (string | undefined)[]][] = [
    // Claude Code sets CLAUDE_CODE_SSE_PORT but std-env only checks CLAUDECODE/CLAUDE_CODE
    ['claude', [env.CLAUDE_CODE_SSE_PORT]],
    // GitHub Copilot (CLI or Chat)
    ['copilot', [env.GITHUB_COPILOT, env.COPILOT_AGENT]],
    // Cline (VS Code extension)
    ['cline', [env.CLINE, env.CLINE_TASK_ID]],
    // Windsurf
    ['windsurf', [env.WINDSURF, env.WINDSURF_SESSION_ID]],
    // Aider
    ['aider', [env.AIDER]],
    // Bolt
    ['bolt', [env.BOLT, env.BOLT_SESSION_ID]],
    // v0 (Vercel)
    ['v0', [env.V0_DEV]],
    // Lovable
    ['lovable', [env.LOVABLE]],
  ];

  for (const [name, values] of extraChecks) {
    if (values.some(Boolean)) return { name };
  }

  return {};
}

export const isAgent = Boolean(detectAgent().name);
