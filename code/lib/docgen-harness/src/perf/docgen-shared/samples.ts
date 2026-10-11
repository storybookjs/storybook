export interface MemorySample {
  /** Resident Set Size, the total memory allocated for the process. */
  rssMb: number;
  /** The V8 heap used by the process. */
  heapUsedMb: number;
  /** Post-GC heap. Present only when the child runs under `node --expose-gc`. */
  retainedHeapMb?: number;
}

export interface SaveSample extends MemorySample {
  /** The save number, counting from 1. */
  save: number;
  /** The duration of the save's re-extraction, in milliseconds. */
  durMs: number;
}
