import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCsf } from './CsfFile.ts';
import golden from './__corpus__/golden.json';

// Golden outputs were recorded from the Babel implementation with `__corpus__/record.mjs`. They
// are compared with `toEqual` so `vitest -u` cannot re-baseline them from this implementation.

const inputs = join(__dirname, '__corpus__', 'inputs');

const regexOrArray = (value: unknown) =>
  value instanceof RegExp ? { regex: value.source, flags: value.flags } : (value ?? null);

const summarize = (file: string, code: string) => {
  let csf;
  try {
    csf = loadCsf(code, { fileName: file, makeTitle: (title) => title ?? 'Untitled' }).parse();
  } catch {
    return { error: true };
  }
  const bindings: Record<string, { constant: boolean; uses: number }> = {};
  for (const [name, binding] of csf._editor.scopes.program.bindings) {
    bindings[name] = { constant: binding.constant, uses: binding.references.length };
  }
  return {
    indexInputs: csf.indexInputs,
    meta: {
      title: csf._meta?.title ?? null,
      id: csf._meta?.id ?? null,
      tags: csf._meta?.tags ?? null,
      component: csf._meta?.component ?? null,
      includeStories: regexOrArray(csf._meta?.includeStories),
      excludeStories: regexOrArray(csf._meta?.excludeStories),
      isFactory: !!csf._metaIsFactory,
    },
    stories: Object.fromEntries(
      Object.entries(csf._stories).map(([exportName, story]) => [
        exportName,
        { id: story.id, name: story.name, tags: story.tags, localName: story.localName ?? null },
      ])
    ),
    namedExportsOrder: csf._namedExportsOrder ?? null,
    bindings,
  };
};

// Babel parsed every file with the JSX plugin, so `.ts`-only syntax such as `<T>(x: T) => x` was a
// parse error there and is indexed here. These files have their own expectations below.
const improved = new Set(['edge-typescript.stories.ts']);

const summaryOf = (file: string) =>
  JSON.parse(JSON.stringify(summarize(file, readFileSync(join(inputs, file), 'utf8'))));

describe('CSF corpus', () => {
  const files = readdirSync(inputs).sort();

  it('covers every recorded file', () => {
    expect(files).toEqual(Object.keys(golden).sort());
  });

  it.each(files.filter((file) => !improved.has(file)))(
    'indexes %s like the Babel implementation did',
    (file) => {
      expect(summaryOf(file)).toEqual(golden[file as keyof typeof golden]);
    }
  );

  it('indexes .ts files that Babel rejected', () => {
    expect(golden['edge-typescript.stories.ts']).toEqual({ error: true });
    const summary = summaryOf('edge-typescript.stories.ts');
    expect(summary.meta.title).toBe('Edge/TypeScript');
    expect(Object.keys(summary.stories)).toEqual(['Primary', 'Sized', 'Composed']);
    expect(summary.stories.Composed.name).toBe('Composed name');
    expect(summary.stories.Sized.tags).toEqual(['!dev']);
  });
});
