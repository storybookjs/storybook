// Group 1 of 6 — How much content?
//
// Does more design-system content keep helping, and where does it stop?
// Four levels, in increasing order: no MCP at all, docgen only, stories with
// an API reference, everything. stories-api-ref stands in for a "base" arm —
// Droppy has no equivalent base stories.
//
// UI editing workflows (702 rework, 703 fix a bug, 704 fix a11y).
//
// 4 arm(s) × 3 eval(s) = 12 cells, 120 runs, 6 batches of at most 2 cells.
// Cells collected by an earlier group are skipped.
//
//   yarn workspace agent-eval run eval:plan --config plans/1-levels-edit.plan.ts --dry
//   yarn workspace agent-eval run eval:plan --config plans/1-levels-edit.plan.ts
import type { RunPlan } from '../lib/agentic-reference/run-plan.ts';

export default {
  experiments: [
    'agentic-ref-cc-control-none-opus-high',
    'agentic-ref-cc-empty-opus-high',
    'agentic-ref-cc-stories-api-ref-opus-high',
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
