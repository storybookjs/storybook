// Group 3 of 6 — What does JSDoc contribute?
//
// `full` minus its JSDoc comments, against `full` itself. The gap is what
// the agent was getting from JSDoc alone.
//
// UI editing workflows (702 rework, 703 fix a bug, 704 fix a11y).
//
// `full` is collected by group 1; it is listed here so the comparison is self-contained, and
// will be skipped as already collected.
//
// 2 arm(s) × 3 eval(s) = 6 cells, 60 runs, 3 batches of at most 2 cells.
// Cells collected by an earlier group are skipped.
//
//   yarn eval:plan --config plans/3-jsdoc-edit.plan.ts --dry
//   yarn eval:plan --config plans/3-jsdoc-edit.plan.ts
import type { RunPlan } from '../lib/agentic-reference/run-plan.ts';

export default {
  experiments: [
    'agentic-ref-cc-control-none-opus-high',
    'agentic-ref-cc-purge-jsdoc-opus-high',
    'agentic-ref-cc-purge-docgen-opus-high',
    'agentic-ref-cc-full-opus-high',
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
