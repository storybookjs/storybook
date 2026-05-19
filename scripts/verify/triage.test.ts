import { describe, expect, it } from 'vitest';

import { matchedTriageGlobs, triageReferenceSpecs } from './triage.ts';
import { TRIAGE_ROUTES } from './recipes/triage-table.ts';

// EPIC-5.6 (triage half) — every route in the TRIAGE_ROUTES table must match a
// representative changed path, and the nextjs vs nextjs-vite routes must be
// DISTINCT entries (they map to the same reference spec but are different
// globs and must not collapse). matchedTriageGlobs is pure (no fs); we use it
// to exercise the routing table without depending on on-disk spec files.

// A representative changed path that should match each route's pathGlob.
function sampleFor(glob: string): string {
  // Replace the trailing /** with a concrete nested file.
  return glob.replace(/\/\*\*$/, '/src/index.ts').replace(/\*\*$/, 'index.ts');
}

describe('TRIAGE_ROUTES — every route maps to its expected glob', () => {
  for (const route of TRIAGE_ROUTES) {
    it(`route "${route.pathGlob}" matches a representative changed path`, () => {
      const changed = [sampleFor(route.pathGlob)];
      const matched = matchedTriageGlobs(changed);
      expect(matched).toContain(route.pathGlob);
    });
  }

  it('a path under no route returns no matched globs', () => {
    expect(matchedTriageGlobs(['docs/some-doc.md'])).toEqual([]);
    expect(matchedTriageGlobs(['scripts/verify/triage.ts'])).toEqual([]);
  });

  it('accumulates ALL matching globs across multiple changed paths', () => {
    const matched = matchedTriageGlobs([
      'code/core/src/manager/components/sidebar/Sidebar.tsx',
      'code/addons/a11y/src/index.ts',
    ]);
    expect(matched).toContain('code/core/src/manager/**');
    expect(matched).toContain('code/addons/a11y/**');
  });
});

describe('TRIAGE_ROUTES — nextjs ≠ nextjs-vite (distinct routes)', () => {
  const nextjsRoute = TRIAGE_ROUTES.find((r) => r.pathGlob === 'code/frameworks/nextjs/**');
  const nextjsViteRoute = TRIAGE_ROUTES.find(
    (r) => r.pathGlob === 'code/frameworks/nextjs-vite/**'
  );

  it('both routes exist and are separate table entries', () => {
    expect(nextjsRoute).toBeDefined();
    expect(nextjsViteRoute).toBeDefined();
    expect(nextjsRoute).not.toBe(nextjsViteRoute);
  });

  it('a nextjs-vite diff matches the nextjs-vite glob and NOT the webpack nextjs glob', () => {
    const matched = matchedTriageGlobs(['code/frameworks/nextjs-vite/src/preset.ts']);
    expect(matched).toContain('code/frameworks/nextjs-vite/**');
    expect(matched).not.toContain('code/frameworks/nextjs/**');
  });

  it('a webpack nextjs diff matches the nextjs glob and NOT the nextjs-vite glob', () => {
    const matched = matchedTriageGlobs(['code/frameworks/nextjs/src/preset.ts']);
    expect(matched).toContain('code/frameworks/nextjs/**');
    expect(matched).not.toContain('code/frameworks/nextjs-vite/**');
  });

  it('nextjs and nextjs-vite globs are disjoint (no routing collision)', () => {
    // NOTE: matchedTriageGlobs ACCUMULATES every matching glob (there is no
    // first-match-wins / ordering here — see the "accumulates ALL matching
    // globs" test above). So this is purely a disjointness check: assert that
    // `code/frameworks/nextjs/**` does NOT also match
    // `code/frameworks/nextjs-vite/...` (which would be a routing collision
    // double-routing a Vite-only diff through the webpack reference spec).
    const nextjsGlob = nextjsRoute!.pathGlob;
    const collision = matchedTriageGlobs(['code/frameworks/nextjs-vite/src/x.ts']).includes(
      nextjsGlob
    );
    expect(collision).toBe(false);
  });
});

describe('triageReferenceSpecs — resolution + dedupe (fs edge)', () => {
  it('returns no specs for an unmatched diff (no routes fire)', () => {
    expect(triageReferenceSpecs(['README.md'])).toEqual([]);
  });

  it('does not throw and returns absolute paths (or skips missing) for a matched diff', () => {
    // Reference specs may or may not exist on disk in this worktree; the
    // contract is: never throw, dedupe by abs path, only emit existing files.
    const out = triageReferenceSpecs(['code/core/src/manager/x.ts']);
    expect(Array.isArray(out)).toBe(true);
    for (const p of out) {
      expect(p.startsWith('/')).toBe(true);
    }
    // dedupe invariant holds regardless of which specs exist
    expect(new Set(out).size).toBe(out.length);
  });
});
