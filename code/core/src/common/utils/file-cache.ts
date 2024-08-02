import fsc from 'file-system-cache';

const Cache = fsc;

export type Options = Parameters<typeof Cache>['0'];
export type FileSystemCache = ReturnType<typeof Cache>;

export function createFileSystemCache(options: Options): FileSystemCache {
  return Cache(options);
}
