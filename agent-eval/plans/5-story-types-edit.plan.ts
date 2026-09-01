// Group 5 of 6 — Which kinds of stories pay off?
//
// The stories counterpart of group 4. Lower expected return, so it runs
// after the documentation facets.
//
// UI editing workflows (702 rework, 703 fix a bug, 704 fix a11y).
//
// stories-api-ref (group 1) and stories-full (group 2) are collected earlier; they are listed
// here so the comparison is self-contained, and will be skipped as already collected.
//
// 5 arm(s) × 3 eval(s) = 15 cells, 150 runs, 9 batches of at most 2 cells.
// Cells collected by an earlier group are skipped.
//
//   yarn workspace agent-eval run eval:plan --config plans/5-story-types-edit.plan.ts --dry
//   yarn workspace agent-eval run eval:plan --config plans/5-story-types-edit.plan.ts
import type { RunPlan } from '../lib/agentic-reference/run-plan.ts';

export default {
  experiments: [
    'agentic-ref-cc-stories-api-ref-opus-high',
    'agentic-ref-cc-stories-showcase-opus-high',
    'agentic-ref-cc-stories-highlight-opus-high',
    'agentic-ref-cc-stories-examples-opus-high',
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
