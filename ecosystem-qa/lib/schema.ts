import { z } from 'zod';

import { CHECK_IDS } from '../checks.ts';

export const RepoClass = z.enum(['owned', 'tier1', 'tier2']);
export type RepoClass = z.infer<typeof RepoClass>;
export const Engine = z.enum(['claude', 'codex']);
export type Engine = z.infer<typeof Engine>;
export const SandboxKind = z.enum(['docker', 'bwrap', 'seatbelt', 'none']);
export const Os = z.enum(['linux', 'windows', 'macos']);
export type Os = z.infer<typeof Os>;
export const Effort = z.enum(['low', 'medium', 'high']);

export const CatalogEntry = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  // Where the cycle branch is pushed: a fork under storybookjs for tier 1, the repo itself when owned.
  pushTo: z
    .string()
    .regex(/^storybookjs\/[\w.-]+$/)
    .optional(),
  ref: z.string().min(1),
  class: RepoClass,
  packageManager: z.enum(['npm', 'pnpm', 'yarn']),
  storybookDir: z.string().min(1),
  windows: z.boolean(),
});
export type CatalogEntry = z.infer<typeof CatalogEntry>;

export const Catalog = z
  .array(CatalogEntry)
  .refine((entries) => new Set(entries.map((entry) => entry.id)).size === entries.length, {
    message: 'catalog ids must be unique',
  });

const CheckId = z.enum(CHECK_IDS);

// Evidence is named relative to the evidence directory, at most one directory deep, and no segment
// may start with a dot, so a name can never climb out of that directory.
const EvidenceName = z.string().regex(/^[\w-][\w.-]*(?:\/[\w-][\w.-]*)?$/);
const Sha = z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/);

export const CheckResult = z.strictObject({
  id: CheckId,
  label: z.string(),
  state: z.enum(['pass', 'fail', 'n/a', 'blocked', 'skip']),
  note: z.string().optional(),
});

export const Finding = z.strictObject({
  checkId: CheckId,
  title: z.string().min(1),
  baseline: z.enum(['pass', 'fail', 'not-captured', 'not-applicable']),
  expected: z.string().min(1),
  actual: z.string().min(1),
  errorText: z.string().optional(),
  reproSteps: z.array(z.string().min(1)).min(1),
  evidence: z.strictObject({
    png: EvidenceName.optional(),
    gif: EvidenceName.optional(),
    logs: z.array(EvidenceName),
  }),
  windowsOnly: z.boolean(),
  severityHint: z.enum(['S0', 'S1', 'S2', 'S3', 'S4']).optional(),
});
export type Finding = z.infer<typeof Finding>;

export const AgentOutput = z
  .strictObject({
    storybookVersionInstalled: z.string().nullable(),
    checks: z.array(CheckResult),
    findings: z.array(Finding),
  })
  .superRefine((output, ctx) => {
    const reported = output.checks.map((check) => check.id);
    for (const id of CHECK_IDS) {
      const count = reported.filter((reportedId) => reportedId === id).length;
      if (count !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['checks'],
          message: `check "${id}" must be reported exactly once, found ${count}`,
        });
      }
    }
    for (const [index, finding] of output.findings.entries()) {
      const check = output.checks.find((candidate) => candidate.id === finding.checkId);
      if (check?.state !== 'fail') {
        ctx.addIssue({
          code: 'custom',
          path: ['findings', index, 'checkId'],
          message: `finding for "${finding.checkId}" needs that check to be "fail"`,
        });
      }
    }
  });

export const RunRequestRecord = z.strictObject({
  entry: CatalogEntry,
  version: z.string(),
  engine: Engine,
  model: z.string(),
  effort: Effort,
  sandbox: SandboxKind,
  os: Os,
  fake: z.boolean(),
});

export const RunResultFile = z.strictObject({
  request: RunRequestRecord,
  storybookVersionInstalled: z.string().nullable(),
  startSha: Sha,
  headSha: Sha.nullable(),
  checks: z.array(CheckResult),
  findings: z.array(Finding),
  usage: z.strictObject({
    inputTokens: z.number(),
    outputTokens: z.number(),
    cacheReadTokens: z.number().optional(),
    cacheWriteTokens: z.number().optional(),
    usd: z.number().nullable(),
    model: z.string(),
    priceSource: z.enum(['agent', 'table']),
  }),
  timing: z.strictObject({
    startedAt: z.string(),
    finishedAt: z.string(),
    wallSeconds: z.number(),
    installSeconds: z.number().optional(),
  }),
  machine: z.strictObject({
    node: z.string(),
    freeDiskMbAtEnd: z.number().optional(),
  }),
  // Relative to the directory of result.json, so a downloaded artifact still resolves.
  paths: z.strictObject({
    runLog: z.string(),
    session: z.string().optional(),
    evidenceDir: z.string(),
    bundle: z.string().optional(),
  }),
  status: z.enum(['ok', 'agent-failed', 'output-invalid', 'timeout']),
  error: z.string().optional(),
});
export type RunResultFile = z.infer<typeof RunResultFile>;

const Source = z.strictObject({
  resultPath: z.string(),
  repo: z.string(),
  os: Os,
  engine: Engine,
  model: z.string(),
  sandbox: SandboxKind,
  version: z.string(),
  fake: z.boolean(),
});

// The filer pushes with a write token to the repository, branch and head named here, so they come
// from the catalog, the run request and the bundle header, never from what result.json says.
export const Cycle = z.strictObject({
  repo: CatalogEntry.shape.repo,
  branch: z.string(),
  startSha: Sha,
  headSha: Sha.nullable(),
  bundle: z.string().nullable(),
});
export type Cycle = z.infer<typeof Cycle>;

export const EvidenceFile = z.strictObject({ localPath: z.string(), name: EvidenceName });
export type EvidenceFile = z.infer<typeof EvidenceFile>;

const ProposalBase = {
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/),
  title: z.string().min(1),
  sources: z.array(Source).min(1),
};

const ReportBase = {
  ...ProposalBase,
  labels: z.array(z.string()),
  milestone: z.string(),
  finding: Finding,
  cycle: Cycle,
  runUrl: z.string(),
};

export const Proposal = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('issue'),
    ...ReportBase,
    system: z.string(),
    assetDir: z.string(),
    evidence: z.array(EvidenceFile),
  }),
  z.strictObject({ kind: z.literal('comment'), ...ReportBase, existingIssue: z.number().int() }),
  z.strictObject({
    kind: z.literal('suppressed'),
    ...ProposalBase,
    existingIssue: z.number().int(),
  }),
]);
export type Proposal = z.infer<typeof Proposal>;
export type IssueProposal = Extract<Proposal, { kind: 'issue' }>;
export type CommentProposal = Extract<Proposal, { kind: 'comment' }>;
