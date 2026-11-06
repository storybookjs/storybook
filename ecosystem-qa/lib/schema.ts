import { z } from 'zod';

import { CHECK_IDS } from '../checks.ts';

export const RepoClass = z.enum(['owned', 'tier1', 'tier2']);
export const Engine = z.enum(['claude', 'codex']);
export const SandboxKind = z.enum(['docker', 'bwrap', 'seatbelt', 'none']);
export const Os = z.enum(['linux', 'windows', 'macos']);
export const Effort = z.enum(['low', 'medium', 'high']);

export const CatalogEntry = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  ref: z.string().min(1),
  class: RepoClass,
  packageManager: z.enum(['npm', 'pnpm', 'yarn']),
  storybookDir: z.string().min(1),
  windows: z.boolean(),
});

export const Catalog = z
  .array(CatalogEntry)
  .refine((entries) => new Set(entries.map((entry) => entry.id)).size === entries.length, {
    message: 'catalog ids must be unique',
  });

const CheckId = z.enum(CHECK_IDS);

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
    png: z.string().optional(),
    gif: z.string().optional(),
    logs: z.array(z.string()),
  }),
  windowsOnly: z.boolean(),
  severityHint: z.enum(['S0', 'S1', 'S2', 'S3', 'S4']).optional(),
});

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

const RunRequestRecord = z.strictObject({
  entry: CatalogEntry,
  version: z.string(),
  engine: Engine,
  model: z.string(),
  effort: Effort,
  sandbox: SandboxKind,
  os: Os,
  cycleBranch: z.string(),
});

export const RunResultFile = z.strictObject({
  request: RunRequestRecord,
  storybookVersionInstalled: z.string().nullable(),
  startSha: z.string(),
  cycleBranch: z.string(),
  headSha: z.string().nullable(),
  checks: z.array(CheckResult),
  findings: z.array(Finding),
  usage: z.strictObject({
    inputTokens: z.number(),
    outputTokens: z.number(),
    cacheReadTokens: z.number().optional(),
    cacheWriteTokens: z.number().optional(),
    usd: z.number().nullable(),
    model: z.string(),
  }),
  timing: z.strictObject({
    startedAt: z.string(),
    finishedAt: z.string(),
    wallSeconds: z.number(),
    installSeconds: z.number().optional(),
  }),
  machine: z.strictObject({
    os: Os,
    node: z.string(),
    freeDiskMbAtEnd: z.number().optional(),
    peakRssMb: z.number().optional(),
  }),
  paths: z.strictObject({
    runLog: z.string(),
    session: z.string().optional(),
    evidenceDir: z.string(),
    bundle: z.string().optional(),
  }),
  status: z.enum(['ok', 'agent-failed', 'output-invalid', 'timeout']),
  error: z.string().optional(),
});

export const Proposal = z.strictObject({
  kind: z.enum(['issue', 'comment', 'suppressed']),
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/),
  existingIssue: z.number().int().optional(),
  title: z.string(),
  body: z.string(),
  labels: z.array(z.string()),
  milestone: z.string(),
  evidenceFiles: z.array(z.string()),
  sources: z.array(
    z.strictObject({ repo: z.string(), os: Os, engine: Engine, resultPath: z.string() })
  ),
});
