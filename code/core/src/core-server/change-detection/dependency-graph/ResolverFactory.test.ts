/**
 * Integration tests for ChangeDetectionResolverFactory alias and tsconfig path resolution.
 *
 * These tests use real file system access and the real oxc-resolver binary so that we catch
 * oxc-resolver behavioural differences (e.g. trailing-slash alias keys not working, tsconfig
 * path resolution) rather than just testing our own normalisation logic.
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChangeDetectionResolverFactory } from './ResolverFactory.ts';

let dir: string;

beforeEach(() => {
  // realpathSync resolves macOS /var → /private/var symlink so path comparisons work
  dir = realpathSync(mkdtempSync(join(tmpdir(), 'sb-resolver-test-')));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(relPath: string, content = 'export {};') {
  const abs = join(dir, relPath);
  mkdirSync(join(dir, relPath, '..'), { recursive: true });
  writeFileSync(abs, content);
  return abs;
}

function tsconfig(compilerOptions: Record<string, unknown>, filename = 'tsconfig.json') {
  const abs = join(dir, filename);
  writeFileSync(abs, JSON.stringify({ compilerOptions }));
  return abs;
}

describe('ChangeDetectionResolverFactory', () => {
  describe('no alias, no tsconfig', () => {
    it('resolves relative imports', async () => {
      const a = write('src/a.ts');
      const b = write('src/b.ts');
      const r = new ChangeDetectionResolverFactory({ projectRoot: dir });
      expect(await r.resolve(a, './b')).toBe(b);
    });

    it('returns null for bare specifiers without node_modules', async () => {
      const a = write('src/a.ts');
      const r = new ChangeDetectionResolverFactory({ projectRoot: dir });
      expect(await r.resolve(a, 'react')).toBeNull();
    });
  });

  describe('explicit alias (Record form)', () => {
    it('resolves alias to absolute path', async () => {
      const target = write('src/utils/index.ts');
      const from = write('src/components/Foo.ts');
      const r = new ChangeDetectionResolverFactory({
        projectRoot: dir,
        alias: { utils: join(dir, 'src/utils') },
      });
      expect(await r.resolve(from, 'utils/index')).toBe(target);
    });

    it('strips trailing slash from alias key (oxc-resolver does not support @/ prefix keys)', async () => {
      const target = write('src/app/Component.ts');
      const from = write('src/pages/Page.ts');
      // "@/" with trailing slash would fail in raw oxc-resolver; we normalise it to "@"
      const r = new ChangeDetectionResolverFactory({
        projectRoot: dir,
        alias: { '@/': join(dir, 'src') + '/' },
      });
      expect(await r.resolve(from, '@/app/Component')).toBe(target);
    });
  });

  describe('explicit alias (Array form)', () => {
    it('resolves array alias with string find', async () => {
      const target = write('src/utils/helper.ts');
      const from = write('src/a.ts');
      const r = new ChangeDetectionResolverFactory({
        projectRoot: dir,
        alias: [{ find: 'utils', replacement: join(dir, 'src/utils') }],
      });
      expect(await r.resolve(from, 'utils/helper')).toBe(target);
    });

    it('strips trailing slash from array alias find', async () => {
      const target = write('src/shared/util.ts');
      const from = write('src/a.ts');
      const r = new ChangeDetectionResolverFactory({
        projectRoot: dir,
        alias: [{ find: '~@/', replacement: join(dir, 'src') + '/' }],
      });
      expect(await r.resolve(from, '~@/shared/util')).toBe(target);
    });

    it('returns null and does not throw for regex aliases (unsupported, opaque-leaf)', async () => {
      const from = write('src/a.ts');
      write('src/utils/foo.ts');
      const r = new ChangeDetectionResolverFactory({
        projectRoot: dir,
        alias: [{ find: /^utils\/(.*)/, replacement: join(dir, 'src/utils/$1') }],
      });
      expect(await r.resolve(from, 'utils/foo')).toBeNull();
    });
  });

  describe('tsconfig path aliases (auto-discovered via resolveFileAsync)', () => {
    it('resolves standard wildcard pattern "@/*"', async () => {
      const target = write('src/components/Button.tsx');
      const from = write('src/pages/Home.tsx');
      tsconfig({ baseUrl: '.', paths: { '@/*': ['./*'] } });
      const r = new ChangeDetectionResolverFactory({ projectRoot: dir });
      expect(await r.resolve(from, '@/src/components/Button')).toBe(target);
    });

    it('resolves named wildcard pattern "components/*"', async () => {
      const target = write('src/ui/Button.tsx');
      const from = write('src/pages/Home.tsx');
      tsconfig({ baseUrl: '.', paths: { 'components/*': ['src/ui/*'] } });
      const r = new ChangeDetectionResolverFactory({ projectRoot: dir });
      expect(await r.resolve(from, 'components/Button')).toBe(target);
    });

    it('resolves multiple tsconfig path entries', async () => {
      const btn = write('src/ui/Button.tsx');
      const util = write('src/helpers/format.ts');
      const from = write('src/pages/Home.tsx');
      tsconfig({
        baseUrl: '.',
        paths: {
          'components/*': ['src/ui/*'],
          'helpers/*': ['src/helpers/*'],
        },
      });
      const r = new ChangeDetectionResolverFactory({ projectRoot: dir });
      expect(await r.resolve(from, 'components/Button')).toBe(btn);
      expect(await r.resolve(from, 'helpers/format')).toBe(util);
    });

    it('explicit alias and tsconfig wildcard paths resolve consistently', async () => {
      const target = write('src/ui/Button.tsx');
      const from = write('src/pages/Home.tsx');
      tsconfig({ baseUrl: '.', paths: { '@/*': ['src/ui/*'] } });
      const r = new ChangeDetectionResolverFactory({ projectRoot: dir });
      expect(await r.resolve(from, '@/Button')).toBe(target);
    });

    it('returns null for tsconfig path alias when no tsconfig exists', async () => {
      const from = write('src/a.ts');
      // No tsconfig.json written — @/* has no resolver backing
      const r = new ChangeDetectionResolverFactory({ projectRoot: dir });
      expect(await r.resolve(from, '@/src/a')).toBeNull();
    });

    it('handles tsconfig without baseUrl (paths relative to tsconfig dir)', async () => {
      const target = write('src/components/Button.tsx');
      const from = write('src/pages/Home.tsx');
      // No baseUrl — TypeScript resolves paths relative to tsconfig dir
      tsconfig({ paths: { '@/*': ['src/*'] } });
      const r = new ChangeDetectionResolverFactory({ projectRoot: dir });
      expect(await r.resolve(from, '@/components/Button')).toBe(target);
    });

    it('resolves "@/*": ["./*"] from deeply nested source file (dify-plus pattern)', async () => {
      // Reproduces: @/app/components/base/icons/IconBase unresolved from
      // app/components/base/icons/src/vender/line/others/Tools.tsx
      // oxc-resolver's resolveFileAsync walks up from the file to find tsconfig.json
      const target = write('app/components/base/icons/IconBase.tsx');
      const from = write('app/components/base/icons/src/vender/line/others/Tools.tsx');
      tsconfig({ paths: { '@/*': ['./*'], '~@/*': ['./*'] } });
      const r = new ChangeDetectionResolverFactory({ projectRoot: dir });
      expect(await r.resolve(from, '@/app/components/base/icons/IconBase')).toBe(target);
    });
  });
});
