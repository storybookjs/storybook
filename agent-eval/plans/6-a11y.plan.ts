// Accessibility guidance branch VS a11y bug fixing workflow.
//
//   yarn workspace agent-eval run eval:plan --config plans/6-a11y.plan.ts --dry
//   yarn workspace agent-eval run eval:plan --config plans/6-a11y.plan.ts
import type { RunPlan } from '../lib/agentic-reference/run-plan.ts';

export default {
  experiments: ['agentic-ref-cc-a11y-opus-high'],
  // Directly relevant workflow.
  evals: ['704'],
  // Run all evals to check the cost of adding a11y context to edit workflows,
  // and to check the value of a11y context in newly created UI.
  // evals: ['701', '702', '703', '704', '706'],
  runs: 10,
  parallelMax: 10,
  force: false,
  ackFailures: false,
} satisfies RunPlan;
