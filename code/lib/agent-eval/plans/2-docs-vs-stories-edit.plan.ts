// Group 2 of 6 — Docs or stories?
//
// Given a full corpus of one kind, which carries more of the benefit —
// prose documentation or stories? Compare each against the `full` arm
// collected in group 1.
//
// UI editing workflows (702 rework, 703 fix a bug, 704 fix a11y).
//
// 2 arm(s) × 3 eval(s) = 6 cells, 60 runs, 3 batches of at most 2 cells.
// Cells collected by an earlier group are skipped.
//
//   yarn workspace agent-eval run eval:plan --config plans/2-docs-vs-stories-edit.plan.ts --dry
//   yarn workspace agent-eval run eval:plan --config plans/2-docs-vs-stories-edit.plan.ts
import type { RunPlan } from '../lib/agentic-reference/run-plan.ts';

export default {
  experiments: [
    'agentic-ref-cc-control-none-opus-high',
    'agentic-ref-cc-docs-full-opus-high',
    'agentic-ref-cc-stories-full-opus-high',
  ],
  evals: ['702', '703', '704'],
  runs: 10,
  parallelMax: 10,
  // Off, so an interrupted plan resumes and repeated arms are collected once.
  force: false,
  // Off, so infra and timeout runs are dropped rather than mixed into the
  // sample; the shortfall is reported as a gap with its top-up command.
  ackFailures: false,
  // Set this when the environment around a run changes in a way the harness's
  // fingerprint cannot see — a regenerated Droppy MCP build at the same branch,
  // a new sandbox image, a new agent CLI. A fixture edit needs no cutoff: it
  // changes the fingerprint on its own.
  // since: '2026-08-14',
} satisfies RunPlan;
