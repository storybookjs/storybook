import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { format } from 'prettier';

import { loadCsf, printCsf } from './CsfFile.ts';
import type { CsfObject, CsfPath } from './CsfObject.ts';
import golden from './__corpus__/golden.json';
import { summarizeTransforms } from './__corpus__/summarize.ts';
import transforms from './__corpus__/transforms.json';
import { appendMembers, appendStatement } from './estree/editor.ts';
import { parseExpression, textOf } from './estree/ast.ts';
import * as csfTools from './index.ts';

// `golden.json` was recorded from the Babel implementation and `transforms.json` from this one, both
// with `__corpus__/record.mjs`. They are compared with `toEqual` so `vitest -u` cannot re-baseline
// them.

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
  for (const [name, binding] of csf.editor.scopes.program.bindings) {
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
    expect(files).toEqual(Object.keys(transforms).sort());
  });

  it.each(files.filter((file) => !improved.has(file)))(
    'indexes %s like the Babel implementation did',
    (file) => {
      expect(summaryOf(file)).toEqual(golden[file as keyof typeof golden]);
    }
  );

  it.each(files)('transforms %s like the recorded outputs', async (file) => {
    const code = readFileSync(join(inputs, file), 'utf8');
    expect(await summarizeTransforms({ csfTools, format }, inputs, file, code)).toEqual(
      transforms[file as keyof typeof transforms]
    );
  });

  it.each(files)('documents the stories of %s with their authored source', (file) => {
    const code = readFileSync(join(inputs, file), 'utf8');
    const { originalSources } = transforms[file as keyof typeof transforms];
    for (const source of Object.values(originalSources)) {
      expect(code).toContain(source);
    }
  });

  it('indexes .ts files that Babel rejected', () => {
    expect(golden['edge-typescript.stories.ts']).toEqual({ error: true });
    const summary = summaryOf('edge-typescript.stories.ts');
    expect(summary.meta.title).toBe('Edge/TypeScript');
    expect(Object.keys(summary.stories)).toEqual(['Primary', 'Sized', 'Composed']);
    expect(summary.stories.Composed.name).toBe('Composed name');
    expect(summary.stories.Sized.tags).toEqual(['!dev']);
  });
});

// A run of mutations, reads and raw edits drawn from a seed, traced once as written and once with a
// commit after every mutation that applied, which is how they committed before edits were kept
// pending.
const replay = (file: string, code: string, seed: number, eager: boolean) => {
  let state = seed;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  let csf;
  try {
    csf = loadCsf(code, { fileName: file, makeTitle: (title) => title ?? 'Untitled' }).parse();
  } catch {
    return [];
  }
  const objects = csf.objects();
  if (objects.length === 0) {
    return [];
  }
  const bindings = [...csf.editor.scopes.program.bindings.keys()];
  const keys = ['args', 'argTypes', 'parameters', 'tags', 'name', 'play', 'decorators', 'globals'];
  const nested = ['a', 'b', 'docs', 'label', 'defaultValue', 'control', 0, 1];
  const path = (): CsfPath => {
    const length = 1 + Math.floor(random() * 3);
    return [pick(keys), ...Array.from({ length: length - 1 }, () => pick(nested))];
  };
  const value = () =>
    pick([
      () => 1,
      () => 'x',
      () => ['a'],
      () => ({ a: 1, b: { c: 'd' } }),
      () => parseExpression(`{ ...${pick(bindings) ?? 'x'} }`),
      () => parseExpression('() => {\n  return 1;\n}'),
      () => parseExpression(pick(bindings) ?? 'x'),
    ])();
  const trace: unknown[] = [];
  const ops: string[] = [];
  const record = (label: string, run: () => unknown) => {
    ops.length = 0;
    try {
      const result = JSON.parse(JSON.stringify(run() ?? null));
      trace.push([label, ...ops, result]);
    } catch (error) {
      trace.push([label, ...ops, 'throws', error instanceof Error ? error.message : String(error)]);
    }
  };
  const op = (name: string, ...args: unknown[]) => {
    ops.push(`${name} ${JSON.stringify(args)}`);
  };
  const mutate = (object: CsfObject) => {
    const target = path();
    const who = JSON.stringify(object.target);
    const result = pick([
      () => (op('set', who, target), object.set(target, value())),
      () => (op('refused', who), object.set(['__proto__'], 1)),
      () => (op('remove', who, target), object.remove(target)),
      () => (op('append', who, target), object.append(target, value())),
      () => (op('prepend', who, target), object.prepend(target, value())),
      () => (op('rename', who, target), object.rename(target, pick(['a', 'b', 'renamed']))),
      () => {
        const to = path();
        op('move', who, target, to);
        return object.move(target, to);
      },
      () => {
        const names = [pick(keys), pick(keys)];
        op('group', who, target.slice(0, 1), names);
        return object.group(target.slice(0, 1), names);
      },
      () => (
        op('transform', who, target),
        object.transform(target, (node) => parseExpression(`[${textOf(node)}]`))
      ),
    ])();
    if (eager && result.ok) {
      csf.editor.commit();
    }
    return result;
  };
  const read = (object: CsfObject) => {
    const target = path();
    op('read', JSON.stringify(object.target), target);
    return pick([
      () => object.getValue(target),
      () => object.inspect(target),
      () => {
        const node = object.get(target);
        return node && textOf(node);
      },
    ])();
  };
  for (let step = 0; step < 32; step++) {
    const object = pick(objects);
    const kind = random();
    if (kind < 0.55) {
      record('mutate', () => mutate(object));
    } else if (kind < 0.8) {
      record('read', () => read(object));
    } else if (kind < 0.9) {
      record('transaction', () =>
        csf.transaction(() => {
          mutate(object);
          mutate(pick(objects));
          return random() < 0.7;
        })
      );
    } else if (kind < 0.93) {
      record('raw', () => appendStatement(csf.editor, `${pick(objects).target.kind}Extra();`));
    } else if (kind < 0.96) {
      record('raw', () => {
        const node = object.node;
        if (node) {
          appendMembers(csf.editor, node, [`raw: ${pick(bindings) ?? 'x'}`]);
        }
      });
    } else {
      record('commit', () => {
        csf.editor.commit();
      });
    }
  }
  record('print', () => printCsf(csf).code);
  record('diagnostics', () => csf.mutationDiagnostics);
  record('index', () => csf.indexInputs);
  return trace;
};

// Mutations an enricher of `enrichCsf` makes, as the addons that port their transforms do.
const enrichWithMutations = async (file: string, code: string, eager: boolean) => {
  const load = () => loadCsf(code, { fileName: file, makeTitle: (title) => title ?? 'Untitled' });
  let csf;
  try {
    csf = load().parse();
  } catch {
    return undefined;
  }
  const results: unknown[] = [];
  const mutate = (run: () => { ok: boolean }) => {
    const result = run();
    results.push(result);
    if (eager && result.ok) {
      csf.editor.commit();
    }
  };
  await csfTools.enrichCsf(csf, load().parse(), {
    enrichCsf: async (enriched) => {
      for (const object of enriched.objects()) {
        mutate(() => object.set(['parameters', 'docs', 'enriched'], true));
        mutate(() => object.remove(['argTypes', 'label', 'defaultValue']));
        mutate(() => object.set(['args', 'label'], 'Enriched'));
      }
    },
  });
  return { results, code: printCsf(csf).code, diagnostics: csf.mutationDiagnostics };
};

describe('pending edits', () => {
  const files = readdirSync(inputs).sort();

  it.each(files)(
    'enriches %s with mutations as a commit after every mutation does',
    async (file) => {
      const code = readFileSync(join(inputs, file), 'utf8');
      expect(await enrichWithMutations(file, code, false)).toEqual(
        await enrichWithMutations(file, code, true)
      );
    }
  );

  it.each(files)('mutates %s as a commit after every mutation does', (file) => {
    const code = readFileSync(join(inputs, file), 'utf8');
    for (let seed = 1; seed <= 16; seed++) {
      expect(replay(file, code, seed, false)).toEqual(replay(file, code, seed, true));
    }
  });
});
