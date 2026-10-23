// Covers the construction + mutation surface of ReverseIndexImpl.
import { describe, expect, it } from 'vitest';

import { ReverseIndexImpl } from './reverse-index.ts';

describe('ReverseIndexImpl', () => {
  it('returns an empty Map (not undefined) when looking up an unknown dep', () => {
    const index = new ReverseIndexImpl();

    const result = index.lookup('/repo/src/foo.ts');

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('records (dep, story, depth) and surfaces the depth via lookup', () => {
    const index = new ReverseIndexImpl();

    index.record('/repo/src/foo.ts', '/repo/src/Foo.stories.tsx', 1);

    const result = index.lookup('/repo/src/foo.ts');
    expect(result.get('/repo/src/Foo.stories.tsx')).toBe(1);
  });

  it('keeps min(existing, depth) when the same (dep, story) is recorded twice with different depths', () => {
    const index = new ReverseIndexImpl();

    index.record('/repo/src/foo.ts', '/repo/src/A.stories.tsx', 3);
    index.record('/repo/src/foo.ts', '/repo/src/A.stories.tsx', 1);
    index.record('/repo/src/foo.ts', '/repo/src/A.stories.tsx', 2);

    expect(index.lookup('/repo/src/foo.ts').get('/repo/src/A.stories.tsx')).toBe(1);
  });

  it('records the same dep against multiple stories and surfaces both via lookup', () => {
    const index = new ReverseIndexImpl();

    index.record('/repo/src/shared.ts', '/repo/src/A.stories.tsx', 1);
    index.record('/repo/src/shared.ts', '/repo/src/B.stories.tsx', 2);

    const result = index.lookup('/repo/src/shared.ts');
    expect(result.size).toBe(2);
    expect(result.get('/repo/src/A.stories.tsx')).toBe(1);
    expect(result.get('/repo/src/B.stories.tsx')).toBe(2);
  });

  it('removeStory deletes the story from every inner map and prunes outer entries that become empty', () => {
    const index = new ReverseIndexImpl();
    index.record('/repo/src/x.ts', '/repo/src/A.stories.tsx', 1);
    index.record('/repo/src/x.ts', '/repo/src/B.stories.tsx', 2);
    index.record('/repo/src/y.ts', '/repo/src/A.stories.tsx', 1);

    index.removeStory('/repo/src/A.stories.tsx');

    // /repo/src/y.ts had only A — should be pruned.
    expect(index.asMap().has('/repo/src/y.ts')).toBe(false);
    // /repo/src/x.ts retained for B; A removed.
    const inner = index.lookup('/repo/src/x.ts');
    expect(inner.size).toBe(1);
    expect(inner.get('/repo/src/B.stories.tsx')).toBe(2);
    expect(inner.has('/repo/src/A.stories.tsx')).toBe(false);
  });

  it('removeEdge removes only the (dep, story) pair without touching other stories', () => {
    const index = new ReverseIndexImpl();
    index.record('/repo/src/x.ts', '/repo/src/A.stories.tsx', 1);
    index.record('/repo/src/x.ts', '/repo/src/B.stories.tsx', 2);

    index.removeEdge('/repo/src/x.ts', '/repo/src/A.stories.tsx');

    const inner = index.lookup('/repo/src/x.ts');
    expect(inner.has('/repo/src/A.stories.tsx')).toBe(false);
    expect(inner.get('/repo/src/B.stories.tsx')).toBe(2);
  });

  it('removeEdge prunes the outer entry when it becomes empty', () => {
    const index = new ReverseIndexImpl();
    index.record('/repo/src/x.ts', '/repo/src/A.stories.tsx', 1);

    index.removeEdge('/repo/src/x.ts', '/repo/src/A.stories.tsx');

    expect(index.asMap().has('/repo/src/x.ts')).toBe(false);
  });

  it('handles cycles by retaining the minimum depth across multiple recordings', () => {
    // A imports B (depth 1); B imports C (depth 2); C imports B (would be depth 3).
    // Whatever order build() visits in, recording min keeps depth 1 for B and 2 for C from story A.
    const index = new ReverseIndexImpl();
    index.record('/repo/src/B.ts', '/repo/src/A.stories.tsx', 1);
    index.record('/repo/src/C.ts', '/repo/src/A.stories.tsx', 2);
    // Cycle re-entry attempts:
    index.record('/repo/src/B.ts', '/repo/src/A.stories.tsx', 3);
    index.record('/repo/src/C.ts', '/repo/src/A.stories.tsx', 4);

    expect(index.lookup('/repo/src/B.ts').get('/repo/src/A.stories.tsx')).toBe(1);
    expect(index.lookup('/repo/src/C.ts').get('/repo/src/A.stories.tsx')).toBe(2);
  });
});
