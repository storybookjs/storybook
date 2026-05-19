import { describe, expect, it } from 'vitest';

import { suggestVerifyTarget } from './target-suggest.ts';

// EPIC-5.6 (target-suggest half) — every routing rule maps a representative
// changed path to its expected target, the generic fallback is internal-ui,
// and (critically) `nextjs-vite` ≠ `nextjs`: a nextjs-vite diff must resolve
// to the Vite sandbox, never the webpack one (the historic mis-guess this
// module exists to prevent — see target-suggest.ts header & rule rationale).

describe('suggestVerifyTarget — rule → target mapping', () => {
  const cases: Array<{ changed: string; expected: string }> = [
    { changed: 'code/frameworks/nextjs-vite/src/preset.ts', expected: 'sandbox:nextjs-vite/default-ts' },
    { changed: 'code/frameworks/nextjs/src/preset.ts', expected: 'sandbox:nextjs/default-ts' },
    { changed: 'code/frameworks/svelte-vite/src/index.ts', expected: 'sandbox:svelte-vite/default-ts' },
    { changed: 'code/renderers/svelte/src/render.ts', expected: 'sandbox:svelte-vite/default-ts' },
    { changed: 'code/frameworks/vue3-vite/src/index.ts', expected: 'sandbox:vue3-vite/default-ts' },
    { changed: 'code/renderers/vue3/src/render.ts', expected: 'sandbox:vue3-vite/default-ts' },
    { changed: 'code/frameworks/angular/src/index.ts', expected: 'sandbox:angular-cli/default-ts' },
    { changed: 'code/frameworks/angular-vite/src/index.ts', expected: 'sandbox:angular-cli/default-ts' },
    { changed: 'code/frameworks/react-webpack5/src/index.ts', expected: 'sandbox:react-webpack/default-ts' },
    { changed: 'code/frameworks/react-vite/src/index.ts', expected: 'sandbox:react-vite/default-ts' },
  ];

  for (const { changed, expected } of cases) {
    it(`${changed} → ${expected}`, () => {
      const s = suggestVerifyTarget([changed]);
      expect(s.target).toBe(expected);
      expect(s.matchedGlobs.length).toBeGreaterThan(0);
      expect(s.rationale.length).toBeGreaterThan(0);
    });
  }

  it('falls back to internal-ui when no renderer/framework rule matches', () => {
    const s = suggestVerifyTarget(['code/core/src/manager/index.ts']);
    expect(s.target).toBe('internal-ui');
    expect(s.matchedGlobs).toEqual([]);
  });

  it('falls back to internal-ui for an empty changed-path list', () => {
    expect(suggestVerifyTarget([]).target).toBe('internal-ui');
  });
});

describe('suggestVerifyTarget — nextjs-vite ≠ nextjs (disjoint rules resolve independently)', () => {
  it('a nextjs-vite-only diff resolves to the Vite sandbox, never webpack', () => {
    const s = suggestVerifyTarget(['code/frameworks/nextjs-vite/src/images/next-image.tsx']);
    expect(s.target).toBe('sandbox:nextjs-vite/default-ts');
    expect(s.target).not.toBe('sandbox:nextjs/default-ts');
  });

  it('a webpack-nextjs-only diff resolves to the webpack sandbox, never Vite', () => {
    const s = suggestVerifyTarget(['code/frameworks/nextjs/src/images/next-image.tsx']);
    expect(s.target).toBe('sandbox:nextjs/default-ts');
    expect(s.target).not.toBe('sandbox:nextjs-vite/default-ts');
  });

  it('disjoint nextjs-vite / nextjs rules resolve independently (no cross-bleed)', () => {
    // NOTE: this is NOT a first-match-wins test. Every rule glob in RULES is
    // `code/frameworks/<x>/**` or `code/renderers/<x>/**`, and minimatch
    // `code/frameworks/nextjs/**` does NOT match
    // `code/frameworks/nextjs-vite/...` — so no single changed path can match
    // two different rules' globs. Ordering is therefore unobservable here.
    // What we CAN pin: when a diff touches both packages, the Vite rule still
    // resolves the Vite path correctly (it happens to be listed first, so it
    // is reached first by the top-down loop), and it never mis-routes to the
    // webpack sandbox.
    const s = suggestVerifyTarget([
      'code/frameworks/nextjs-vite/src/x.ts',
      'code/frameworks/nextjs/src/y.ts',
    ]);
    expect(s.target).toBe('sandbox:nextjs-vite/default-ts');
    expect(s.target).not.toBe('sandbox:nextjs/default-ts');
  });
});
