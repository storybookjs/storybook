/** The per-sample shapes every docgen bench harness records. */

export interface MemorySample {
  rssMb: number;
  heapUsedMb: number;
  /** Post-GC heap. Present only when the child runs under `node --expose-gc`. */
  retainedHeapMb?: number;
}

export interface SaveSample extends MemorySample {
  save: number;
  durMs: number;
}
