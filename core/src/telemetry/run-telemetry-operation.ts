import { createFileSystemCache, resolvePathInStorybookCache } from '../common';

const cache = createFileSystemCache({
  basePath: resolvePathInStorybookCache('telemetry'),
  ns: 'storybook',
  ttl: 24 * 60 * 60 * 1000, // 24h
});

/**
 * Run an (expensive) operation, caching the result in a FS cache for 24 hours.
 *
 * NOTE: if the operation returns `undefined` the value will not be cached. Use this to indicate
 * that the operation failed.
 */
export const runTelemetryOperation = async <T>(cacheKey: string, operation: () => Promise<T>) => {
  let cached = await cache.get<T>(cacheKey);
  if (cached === undefined) {
    cached = await operation();
    // Undefined indicates an error, setting isn't really valuable.
    if (cached !== undefined) {
      await cache.set(cacheKey, cached);
    }
  }
  return cached;
};
