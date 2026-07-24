/**
 * Memory sampling shared by the series-harness engine children. Mirrors the docgen-memory harness:
 * pre-GC rss/heapUsed is the transient-pressure signal, post-GC heapUsed (only under
 * `node --expose-gc`) is the retained signal.
 */
import type { MemorySample } from './types.ts';

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
