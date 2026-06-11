export type CheckId =
  | 'human'
  | 'real-problem'
  | 'duplicate'
  | 'cost-benefit'
  | 'explains-test'
  | 'provides-context';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'deferred';

export interface CheckResult {
  id: CheckId;
  status: CheckStatus;
  evidence: string;
  guidance?: string;
}

export type Verdict = 'pass' | 'fail';

export interface LinkedIssue {
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  reactions?: { plus1: number; minus1: number; tada: number };
}

export interface PrContext {
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string;
  body: string;
  author: string;
  isDraft: boolean;
  headSha: string;
  labels: string[];
  files: Array<{
    path: string;
    additions: number;
    deletions: number;
    patch?: string;
    status: string;
  }>;
  linkedIssues: LinkedIssue[];
  brokenLinkRefs: string[];
}

export interface AssessmentResult {
  verdict: Verdict;
  results: CheckResult[];
  earlyAbort: boolean;
  reviewBody: string;
  labelsToAdd: string[];
  labelsToRemove: string[];
}
