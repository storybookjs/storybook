/**
 * Maps `items` with at most `limit` concurrent in-flight `fn` calls.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  // Guard against a non-finite `limit` (e.g. NaN), which would otherwise make
  // `concurrency` NaN and spawn zero workers, leaving results unfilled.
  const safeLimit = Number.isFinite(limit) ? limit : items.length;
  const concurrency = Math.max(1, Math.min(safeLimit, items.length));
  const results = Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}
