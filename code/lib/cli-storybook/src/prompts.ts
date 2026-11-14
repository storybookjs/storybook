import { isCI } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { detectAgent } from 'storybook/internal/telemetry';

// Why this run cannot answer prompts, or `undefined` when a person at a terminal can. Like `create
// storybook`, a run without an interactive terminal, in CI or by a coding agent does not prompt. An
// agent can drive a terminal, but it answers a prompt to finish its task, not on the user's behalf.
// `--no-agent` turns the agent detection off, for a person whose shell std-env mistakes for one.
export function promptlessReason({ detectAgents = true } = {}): string | undefined {
  if (isCI()) {
    return 'CI is set';
  }
  const agent = detectAgents ? detectAgent() : undefined;
  if (agent) {
    return `a coding agent (${agent.name}) runs it (pass --no-agent to answer them yourself)`;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return 'there is no interactive terminal';
  }
  return undefined;
}

// A run that cannot answer prompts gets the answers of `--yes`, instead of aborting halfway on the
// first prompt. Every prompt of `upgrade` and `automigrate` has one.
export function answersPromptsWithYes({
  yes,
  agent,
}: {
  yes?: boolean;
  /** `false` from `--no-agent`. */
  agent?: boolean;
}): boolean {
  if (yes) {
    return true;
  }
  const reason = promptlessReason({ detectAgents: agent !== false });
  if (reason) {
    logger.log(`Running without prompts, as with --yes, because ${reason}.`);
    return true;
  }
  return false;
}
