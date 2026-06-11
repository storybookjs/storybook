export type SkipReason = 'draft' | 'already-assessed' | 'explicit-skip' | 'maintainer';

export interface SkipDecision {
  skip: boolean;
  reason?: SkipReason;
}

export interface SkipDeps {
  isMaintainer(login: string): Promise<boolean>;
}

export async function evaluateSkip(
  pr: { isDraft: boolean; labels: string[]; author: string },
  deps: SkipDeps
): Promise<SkipDecision> {
  if (pr.isDraft) return { skip: true, reason: 'draft' };
  if (pr.labels.includes('mvc:success') || pr.labels.includes('mvc:failed')) {
    return { skip: true, reason: 'already-assessed' };
  }
  if (pr.labels.includes('mvc:skip')) return { skip: true, reason: 'explicit-skip' };
  if (await deps.isMaintainer(pr.author)) return { skip: true, reason: 'maintainer' };
  return { skip: false };
}
