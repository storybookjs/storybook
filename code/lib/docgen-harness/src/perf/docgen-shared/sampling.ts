/**
 * Memory sampling shared by every docgen bench harness: pre-GC rss/heapUsed is the transient-pressure
 * signal, post-GC heapUsed (only under `node --expose-gc`) is the retained signal.
 */
import type { MemorySample } from './samples.ts';

export const MB = 1024 * 1024;

export function gc(): void {
  if (typeof global.gc === 'function') {
    global.gc();
    global.gc();
  }
}

export function gcAvailable(): boolean {
  return typeof global.gc === 'function';
}

export function sampleMemory(forceGc: boolean): MemorySample {
  const pre = process.memoryUsage();
  let retainedHeapMb: number | undefined;
  if (forceGc && gcAvailable()) {
    gc();
    retainedHeapMb = process.memoryUsage().heapUsed / MB;
  }
  return { rssMb: pre.rss / MB, heapUsedMb: pre.heapUsed / MB, retainedHeapMb };
}

/** The one per-save log line every harness prints, so their output stays comparable by eye. */
export function formatSampleLine(save: number, durMs: number, mem: MemorySample): string {
  return (
    `  save ${String(save).padStart(3)}: ${durMs.toFixed(1).padStart(7)}ms  ` +
    `rss=${mem.rssMb.toFixed(0).padStart(5)}MB  heapUsed=${mem.heapUsedMb.toFixed(0).padStart(5)}MB` +
    (mem.retainedHeapMb !== undefined
      ? `  retained=${mem.retainedHeapMb.toFixed(0).padStart(5)}MB`
      : '')
  );
}
