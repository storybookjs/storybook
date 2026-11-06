import type { z } from 'zod';

import type * as schema from './schema.ts';

export type RepoClass = z.infer<typeof schema.RepoClass>;
export type Engine = z.infer<typeof schema.Engine>;
export type SandboxKind = z.infer<typeof schema.SandboxKind>;
export type Os = z.infer<typeof schema.Os>;
export type Effort = z.infer<typeof schema.Effort>;
export type CatalogEntry = z.infer<typeof schema.CatalogEntry>;
export type CheckResult = z.infer<typeof schema.CheckResult>;
export type CheckState = CheckResult['state'];
export type Finding = z.infer<typeof schema.Finding>;
export type AgentOutput = z.infer<typeof schema.AgentOutput>;
// `paths` hold paths relative to the directory of result.json, so a downloaded artifact still resolves.
export type RunResultFile = z.infer<typeof schema.RunResultFile>;
export type Proposal = z.infer<typeof schema.Proposal>;

export interface RunRequest {
  entry: CatalogEntry;
  version: string;
  engine: Engine;
  model: string;
  effort: Effort;
  sandbox: SandboxKind;
  os: Os;
  outDir: string;
  monorepoDir: string;
  cycleBranch: string;
}

export interface Outcome {
  status: RunResultFile['status'];
  error?: string;
  output?: AgentOutput;
  startSha: string;
  headSha: string | null;
  sessionSource?: string;
  bundle?: string;
}
