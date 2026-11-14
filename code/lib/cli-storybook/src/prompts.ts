import { isCI } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { detectAgent } from 'storybook/internal/telemetry';

/**
 * Why this run cannot answer prompts, or `undefined` when a person at a terminal can. Like `create
 * storybook`, a run without an interactive terminal or in CI does not prompt. A coding agent does
 * not either: it can drive a terminal, but it answers a prompt to finish the task, not on the
 * user's behalf, and unticked the default automigrations in our QA.
 */
export function promptlessReason(): string | undefined {
  if (isCI()) {
    return 'CI is set';
  }
  const agent = detectAgent();
  if (agent) {
    return `a coding agent (${agent.name}) runs it`;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return 'there is no interactive terminal';
  }
  return undefined;
}

/**
 * Resolve `--yes` for a command whose prompts all fall back to `yes`: a run that cannot answer
 * prompts gets the answers of `--yes`, instead of aborting halfway on the first prompt.
 */
export function answersPromptsWithYes(yes: boolean | undefined): boolean {
  if (yes) {
    return true;
  }
  const reason = promptlessReason();
  if (reason) {
    logger.log(`Running without prompts, as with --yes, because ${reason}.`);
    return true;
  }
  return false;
}
