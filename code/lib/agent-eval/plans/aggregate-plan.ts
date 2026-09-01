// Aggregate of all ran plans so we can perform a joint statistical analysis
import type { RunPlan } from '../lib/agentic-reference/run-plan.ts';

export default {
  experiments: [
    'agentic-ref-cc-control-none-opus-high',
    'agentic-ref-cc-empty-opus-high',
    'agentic-ref-cc-stories-api-ref-opus-high',
    'agentic-ref-cc-stories-full-opus-high',
    'agentic-ref-cc-docs-full-opus-high',
    'agentic-ref-cc-purge-jsdoc-opus-high',
    'agentic-ref-cc-full-opus-high',
    'agentic-ref-cc-basic-docs-opus-high',
    'agentic-ref-cc-do-dont-opus-high',
    'agentic-ref-cc-when-to-use-opus-high',
    'agentic-ref-cc-history-issues-opus-high',
    'agentic-ref-cc-api-ref-opus-high',
  ],
  evals: ['701', '702', '703', '704', '706'],
  runs: 10,
  parallelMax: 10,
  force: false,
  ackFailures: false,
} satisfies RunPlan;
