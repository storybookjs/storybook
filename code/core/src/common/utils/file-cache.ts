/** This file is a modified copy from https://git.nfp.is/TheThing/fs-cache-fast */
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    this.hash_alg = options.hash_alg || 'md5';
    this.cache_dir =
      options.basePath || join(tmpdir(), randomBytes(15).toString('base64').replace(/\//g, '-'));
    this.ttl = options.ttl || 0;
    createHash(this.hash_alg); // Verifies hash algorithm is available
    mkdirSync(this.cache_dir, { recursive: true });
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
    await writeFile(this.generateHash(name), this.parseSetData(name, data, opts), {
      encoding: opts.encoding || 'utf8',
    });
  }

  public setSync<T>(name: string, data: T, orgOpts: CacheSetOptions | number = {}): void {
    const opts: CacheSetOptions = typeof orgOpts === 'number' ? { ttl: orgOpts } : orgOpts;
    writeFileSync(this.generateHash(name), this.parseSetData(name, data, opts), {
      encoding: opts.encoding || 'utf8',
    });
  }

  public async setMany(items: CacheItem[], options?: CacheSetOptions): Promise<void> {
    await Promise.all(items.map((item) => this.set(item.key, item.content ?? item.value, options)));
  }

  public setManySync(items: CacheItem[], options?: CacheSetOptions): void {
    items.forEach((item) => this.setSync(item.key, item.content ?? item.value, options));
  }

  public async remove(name: string): Promise<void> {
    await rm(this.generateHash(name), { force: true });
  }

  public removeSync(name: string): void {
    rmSync(this.generateHash(name), { force: true });
  }

  public async clear(): Promise<void> {
    const files = await readdir(this.cache_dir);
    await Promise.all(
      files
        .filter((f) => f.startsWith(this.prefix))
        .map((f) => rm(join(this.cache_dir, f), { force: true }))
    );
  }

  public clearSync(): void {
    readdirSync(this.cache_dir)
      .filter((f) => f.startsWith(this.prefix))
      .forEach((f) => rmSync(join(this.cache_dir, f), { force: true }));
  }

  public async getAll(): Promise<CacheItem[]> {
    const now = Date.now();
    const files = await readdir(this.cache_dir);
    const items = await Promise.all(
      files
        .filter((f) => f.startsWith(this.prefix))
        .map((f) => readFile(join(this.cache_dir, f), 'utf8'))
    );
    return items
      .map((data) => JSON.parse(data))
      .filter((entry) => entry.content && !this.isExpired(entry, now));
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
