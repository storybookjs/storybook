/**
 * The docgen engines under measurement. Lives here rather than with the perf suite's result types
 * because the memory gate keys its budgets off the same ids.
 */
export type EngineId =
  | 'react-legacy'
  | 'react-legacy-rdt'
  | 'react-osa'
  | 'vue-docgen-api'
  | 'vue-component-meta'
  | 'compodoc';
