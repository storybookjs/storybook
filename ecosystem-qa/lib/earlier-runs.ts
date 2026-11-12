import { z } from 'zod';

const WORKFLOW_PATH = '.github/workflows/ecosystem-qa.yml';

// What the Actions API says about where a workflow run comes from.
export const RunOrigin = z.object({
  path: z.string(),
  event: z.string(),
  head_branch: z.string().nullable(),
});
export type RunOrigin = z.infer<typeof RunOrigin>;

// Return why the results of a run must not be collected, or nothing when the run can be trusted.
//
// Any run of the repository can upload an artifact named like a result, a pull request from a fork
// included, and the filing job pushes and files what the results say. So only a run of this workflow
// counts, started by hand, which needs write access, on one of `branches`.
export const untrustedBecause = (
  { path, event, head_branch }: RunOrigin,
  branches: string[]
): string | undefined => {
  if (path !== WORKFLOW_PATH) {
    return `is a run of ${path}, not of ${WORKFLOW_PATH}`;
  }
  if (event !== 'workflow_dispatch') {
    return `was started by a ${event} event, not by hand`;
  }
  return head_branch !== null && branches.includes(head_branch)
    ? undefined
    : `ran on ${head_branch ?? 'no branch'}, not on ${branches.join(' or ')}`;
};
