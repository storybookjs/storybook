import * as fsc from 'file-system-cache';

// @ts-expect-error (needed due to it's use of `exports.default`)
const Cache = (fsc.default.default || fsc.default) as typeof fsc.default;

export type Options = Parameters<typeof Cache>['0'];
export type FileSystemCache = ReturnType<typeof Cache>;

export function createFileSystemCache(options: Options): FileSystemCache {
  return Cache(options);
}
