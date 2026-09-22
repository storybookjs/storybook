/** This file is a modified copy from https://git.nfp.is/TheThing/fs-cache-fast */
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import { writeFileWithRetry } from './write-file-with-retry.ts';

interface FileSystemCacheOptions {
  ns?: string;
  prefix?: string;
  hash_alg?: string;
  basePath?: string;
  ttl?: number;
}

interface CacheItem {
  key: string;
  content?: any;
  value?: any;
}

interface CacheSetOptions {
  ttl?: number;
  encoding?: BufferEncoding;
}

export class FileSystemCache {
  private prefix: string;

  private hash_alg: string;

  private cache_dir: string;

  private ttl: number;

  constructor(options: FileSystemCacheOptions = {}) {
    this.prefix = (options.ns || options.prefix || '') + '-';
    this.hash_alg = options.hash_alg || 'sha256';
    this.cache_dir =
      options.basePath || join(tmpdir(), randomBytes(15).toString('base64').replace(/\//g, '-'));
    this.ttl = options.ttl || 0;
    createHash(this.hash_alg); // Verifies hash algorithm is available
    // The cache is a best-effort optimization, not mission critical. Creating the
    // directory can fail (e.g. permissions, antivirus file locks); if it does, we
    // degrade gracefully and let individual reads/writes fail softly later on.
    try {
      mkdirSync(this.cache_dir, { recursive: true });
    } catch (e) {
      this.logFailure('create the cache directory', e);
    }
  }

  /** Logs a file system failure at debug level without throwing. */
  private logFailure(action: string, error: unknown): void {
    logger.debug(
      `[FileSystemCache] Failed to ${action}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  private generateHash(name: string): string {
    return join(this.cache_dir, this.prefix + createHash(this.hash_alg).update(name).digest('hex'));
  }

  private isExpired(parsed: { ttl?: number }, now: number): boolean {
    return parsed.ttl != null && now > parsed.ttl;
  }

  private parseCacheData<T>(data: string, fallback: T | null): T | null {
    const parsed = JSON.parse(data);
    return this.isExpired(parsed, Date.now()) ? fallback : (parsed.content as T);
  }

  private parseSetData<T>(key: string, data: T, opts: CacheSetOptions = {}): string {
    const ttl = opts.ttl ?? this.ttl;
    return JSON.stringify({ key, content: data, ...(ttl && { ttl: Date.now() + ttl * 1000 }) });
  }

  public async get<T = any>(name: string, fallback?: T): Promise<T> {
    try {
      const data = await readFile(this.generateHash(name), 'utf8');
      return this.parseCacheData(data, fallback) as T;
    } catch {
      return fallback as T;
    }
  }

  public getSync<T>(name: string, fallback?: T): T {
    try {
      const data = readFileSync(this.generateHash(name), 'utf8');
      return this.parseCacheData(data, fallback) as T;
    } catch {
      return fallback as T;
    }
  }

  public async set<T>(
    name: string,
    data: T,
    orgOpts: CacheSetOptions | number = {}
  ): Promise<void> {
    const opts: CacheSetOptions = typeof orgOpts === 'number' ? { ttl: orgOpts } : orgOpts;
    try {
      await mkdir(this.cache_dir, { recursive: true });
      await writeFileWithRetry(this.generateHash(name), this.parseSetData(name, data, opts), {
        encoding: opts.encoding || 'utf8',
      });
    } catch (e) {
      this.logFailure(`write cache entry "${name}"`, e);
    }
  }

  public setSync<T>(name: string, data: T, orgOpts: CacheSetOptions | number = {}): void {
    const opts: CacheSetOptions = typeof orgOpts === 'number' ? { ttl: orgOpts } : orgOpts;
    try {
      mkdirSync(this.cache_dir, { recursive: true });
      writeFileSync(this.generateHash(name), this.parseSetData(name, data, opts), {
        encoding: opts.encoding || 'utf8',
      });
    } catch (e) {
      this.logFailure(`write cache entry "${name}"`, e);
    }
  }

  public async setMany(items: CacheItem[], options?: CacheSetOptions): Promise<void> {
    await Promise.all(items.map((item) => this.set(item.key, item.content ?? item.value, options)));
  }

  public setManySync(items: CacheItem[], options?: CacheSetOptions): void {
    items.forEach((item) => this.setSync(item.key, item.content ?? item.value, options));
  }

  public async remove(name: string): Promise<void> {
    try {
      await rm(this.generateHash(name), { force: true });
    } catch (e) {
      this.logFailure(`remove cache entry "${name}"`, e);
    }
  }

  public removeSync(name: string): void {
    try {
      rmSync(this.generateHash(name), { force: true });
    } catch (e) {
      this.logFailure(`remove cache entry "${name}"`, e);
    }
  }

  public async clear(): Promise<void> {
    try {
      const files = await readdir(this.cache_dir);
      await Promise.all(
        files
          .filter((f) => f.startsWith(this.prefix))
          .map((f) => rm(join(this.cache_dir, f), { force: true }))
      );
    } catch (e) {
      this.logFailure('clear the cache', e);
    }
  }

  public clearSync(): void {
    try {
      readdirSync(this.cache_dir)
        .filter((f) => f.startsWith(this.prefix))
        .forEach((f) => rmSync(join(this.cache_dir, f), { force: true }));
    } catch (e) {
      this.logFailure('clear the cache', e);
    }
  }

  public async getAll(): Promise<CacheItem[]> {
    const now = Date.now();
    try {
      const files = await readdir(this.cache_dir);
      const items = await Promise.all(
        files
          .filter((f) => f.startsWith(this.prefix))
          .map((f) => readFile(join(this.cache_dir, f), 'utf8'))
      );
      return items
        .map((data) => JSON.parse(data))
        .filter((entry) => entry.content && !this.isExpired(entry, now));
    } catch (e) {
      this.logFailure('read cache entries', e);
      return [];
    }
  }

  public async load(): Promise<{ files: CacheItem[] }> {
    const res = await this.getAll();
    return {
      files: res.map((entry) => ({
        path: this.generateHash(entry.key),
        value: entry.content,
        key: entry.key,
      })),
    };
  }
}

export function createFileSystemCache(options: FileSystemCacheOptions): FileSystemCache {
  return new FileSystemCache(options);
}
