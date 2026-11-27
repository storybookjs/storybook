// Group 4 of 6 — Which kinds of documentation pay off?
//
// One arm per documentation facet, each against the `full` and `docs-full`
// arms from groups 1 and 2.
//
// UI editing workflows (702 rework, 703 fix a bug, 704 fix a11y).
//
// 5 arm(s) × 3 eval(s) = 15 cells, 150 runs, 9 batches of at most 2 cells.
// Cells collected by an earlier group are skipped.
//
//   yarn eval:plan --config plans/4-doc-types-edit.plan.ts --dry
//   yarn eval:plan --config plans/4-doc-types-edit.plan.ts
import type { RunPlan } from '../lib/agentic-reference/run-plan.ts';

export default {
  experiments: [
    'agentic-ref-cc-control-none-opus-high',
    'agentic-ref-cc-basic-docs-opus-high',
    'agentic-ref-cc-do-dont-opus-high',
    'agentic-ref-cc-when-to-use-opus-high',
    'agentic-ref-cc-history-issues-opus-high',
    'agentic-ref-cc-api-ref-opus-high',
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
