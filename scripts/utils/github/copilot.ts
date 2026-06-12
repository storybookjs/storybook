import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';
import type { IssueOrPrId } from './types.ts';

/**
 * Custom timeline event GitHub emits when a Copilot-driven PR is set up:
 * `{ event: 'copilot_work_started', actor: { login: '<human-operator>' }, ... }`.
 * The `actor` is the human who tasked the agent — exactly the identity we
 * want for skip-rule / maintainer checks. The PR's `user.login` is the bot
 * account (`copilot-swe-agent`) and is useless for that purpose.
 */
const COPILOT_WORK_STARTED = 'copilot_work_started';

async function resolveOperatorImpl(coords: IssueOrPrId): Promise<string | null> {
  const client = getGithubClient();
  let page = 1;
  let earliest: { actor: string; createdAt: string } | null = null;
  while (true) {
    const { data } = await client.rest('GET /repos/{owner}/{repo}/issues/{issue_number}/timeline', {
      owner: coords.owner,
      repo: coords.repo,
      issue_number: coords.number,
      per_page: 100,
      page,
    });
    if (data.length === 0) break;
    for (const event of data) {
      const e = event as {
        event?: string;
        actor?: { login?: string };
        created_at?: string;
      };
      if (e.event !== COPILOT_WORK_STARTED) continue;
      if (!e.actor?.login || !e.created_at) continue;
      if (!earliest || e.created_at < earliest.createdAt) {
        earliest = { actor: e.actor.login, createdAt: e.created_at };
      }
    }
    if (data.length < 100) break;
    page += 1;
  }
  return earliest?.actor ?? null;
}

/**
 * Find the human operator who tasked an automation agent on this PR (today:
 * Copilot, via the `copilot_work_started` timeline event). Returns the
 * earliest such actor — the person who first invoked the agent — or `null`
 * when no such events exist (i.e., the PR was authored by a human directly).
 *
 * Memoized by `coords` identity for the process lifetime.
 */
export const resolveOperator = memoize(1000)(resolveOperatorImpl);
