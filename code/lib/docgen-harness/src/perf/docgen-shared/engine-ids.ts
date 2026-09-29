/**
 * The docgen engines under measurement.
 */
export type EngineId =
  | 'react-legacy'
  | 'react-legacy-rdt'
  | 'react-osa'
  | 'vue-docgen-api'
  | 'vue-component-meta'
  | 'vue-component-meta-next'
  | 'compodoc'
  // Not an engine: a deliberately failing entry the perf gate uses as its negative control.
  | 'crash-control';
