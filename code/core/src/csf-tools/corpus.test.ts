import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { format } from 'prettier';

import { loadConfig, printConfig } from './ConfigFile.ts';
import { loadCsf, printCsf } from './CsfFile.ts';
import { type CsfObject, type CsfPath, printCsfPath } from './CsfObject.ts';
import golden from './__corpus__/golden.json';
import { summarizeTransforms } from './__corpus__/summarize.ts';
import transforms from './__corpus__/transforms.json';
import { appendMembers, appendStatement } from './estree/editor.ts';
import { type E, parseExpression, textOf } from './estree/ast.ts';
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

// Shapes the corpus lacks: layouts where a write joins or breaks a line, two CSF2 stories in one
// declaration, spreads of stories, factory calls with and without an argument, and one-line files.
// Code follows each line a write can join, as `layout` below explains.
const hostile: Record<string, string> = {
  'odd-layout.stories.ts': `export default { title: 'A', args: { a: 1,
  b: 2 }, tags: [] };
export const S = { args: { a: 1,
  b: 2 }, parameters: { x: 1, // c
    y: 2 }, name: 'S' };
export const T = {
  args: { a: [1,
    2], b: 3 },
};
`,
  'csf2-shared.stories.tsx': `export default { title: 'A' };
const Template = (args) => null;
export const A = Template.bind({}), B = Template.bind({});
A.args = { a: 1 };
export const C = Template.bind({});
C.args = { ...A.args };
C.parameters = { x: 1 };
`,
  'spreads.stories.ts': `export default { title: 'A' };
const base = { a: 1 };
export const P = { args: { ...base }, parameters: {} };
export const Q = { ...P, args: { ...P.args, b: 2 } };
export const R = { ...P };
`,
  'factory.stories.ts': `import preview from '#.storybook/preview';
const meta = preview.meta({ title: 'A' });
export const S = meta.story();
export const T = meta.story({ args: { a: 1 } });
export const U = meta.story({});
`,
  'single-line.stories.ts': `export default { title: 'A', args: {} }; export const S = { args: { a: [1, 2] }, argTypes: { a: { control: 'text' } } }; export const T = { args: {} };
`,
  'mixed.stories.ts': `import { expect } from 'storybook/test';
export default { title: 'A' };
export const M = { args: {} };
M.parameters = { a: 1 };
export const N = {
  args: {
    a: 1, // one
    b: 2,
  },
};
`,
};

// Config shapes: a literal, a constant, `module.exports`, named exports, `defineMain()`, and a
// layout where a write joins a line, with code after it.
const configs: Record<string, string> = {
  literal: `export default {\n  addons: ['a', { name: 'b', options: {} }],\n  framework: { name: 'x' },\n  tags: ['a'],\n};\n`,
  constant: `const config = { addons: [], stories: ['../src'] };\nexport default config;\n`,
  cjs: `const { y } = require('mod2');\nmodule.exports = {\n  addons: [\n    'a',\n  ],\n  framework: 'x',\n};\n`,
  named: `import { x } from 'mod';\nexport const addons = ['a'];\nexport const framework = { name: 'x' };\n`,
  define: `import { defineMain } from '@storybook/react-vite/node';\nexport default defineMain({ addons: [], framework: { name: 'x', options: {} } });\n`,
  oneline: `export default { addons: ['a', 'b'], parameters: { a: 1,\n  b: 2 }, core: {} };\n`,
};

// A member on the line of the one before it, so a write can join or break a line, with code after
// it on that line: a join followed only by closing punctuation is a layout limit the README names.
const layout = `export default { title: 'A', args: { a: 1,
  b: 2 }, tags: [] };
export const S = { args: { a: 1,
  b: [1,
    2], c: 3 }, parameters: { x: 1, // c
    y: 2 }, name: 'S' };
`;

// The paths of an object's members, and of the members and items of their values.
const pathsOf = (object: E.ObjectExpression, prefix: CsfPath = []): CsfPath[] =>
  object.properties.flatMap((member) => {
    if (member.type !== 'Property' || member.key.type !== 'Identifier') {
      return [];
    }
    const path = [...prefix, member.key.name];
    const { value } = member;
    if (value.type === 'ObjectExpression') {
      return [path, ...pathsOf(value, path)];
    }
    if (value.type === 'ArrayExpression') {
      return [path, ...value.elements.map((_, index) => [...path, index])];
    }
    return [path];
  });

// Every write a pair of mutations is drawn from: removing or replacing a member, by a value on one
// line or on several, and adding one to an object.
const layoutWrites = (csf: ReturnType<typeof loadCsf>) =>
  csf.objects().flatMap((object, index) => {
    const paths = pathsOf(object.node!);
    const objects = [[], ...paths.filter((path) => object.getValue(path)?.constructor === Object)];
    const multiline = () => parseExpression('() => {\n  return 1;\n}');
    const at = (path: CsfPath) => `${object.target.kind} ${printCsfPath(path) || '{}'}`;
    return [
      ...paths.flatMap((path) => [
        { index, label: `remove ${at(path)}`, run: (o: CsfObject) => o.remove(path) },
        { index, label: `set ${at(path)}`, run: (o: CsfObject) => o.set(path, 1) },
        {
          index,
          label: `set ${at(path)} to lines`,
          run: (o: CsfObject) => o.set(path, multiline()),
        },
      ]),
      ...objects.map((path) => ({
        index,
        label: `add z to ${at(path)}`,
        run: (o: CsfObject) => o.set([...path, 'z'], multiline()),
      })),
    ];
  });

// Seeds per file; `REPLAY_SEEDS=300` runs the guard wider.
const seeds = Number(process.env.REPLAY_SEEDS ?? 16);

const randomOf = (seed: number) => {
  let state = seed;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  return { random, pick };
};

// Records each step's result and the code printed after it. A result is JSON, or what it threw.
const tracer = (print: () => string) => {
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
    trace.push(['printed', print()]);
  };
  const op = (name: string, ...args: unknown[]) => {
    ops.push(`${name} ${JSON.stringify(args)}`);
  };
  return { trace, record, op };
};

// A run of mutations, reads, import edits and raw edits drawn from a seed, traced once as written
// and once with a commit after every mutation that applied, which is how they committed before
// edits were kept pending.
const replay = (file: string, code: string, seed: number, eager: boolean) => {
  const { random, pick } = randomOf(seed);
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
  const keys = [
    'args',
    'argTypes',
    'parameters',
    'tags',
    'name',
    'play',
    'decorators',
    'globals',
    'render',
    'loaders',
    'beforeEach',
    'storyName',
    'component',
    'id',
    'title',
  ];
  const nested = ['a', 'b', 'docs', 'label', 'defaultValue', 'control', 'x', '__id', 0, 1];
  const path = (): CsfPath => {
    const length = 1 + Math.floor(random() * 3);
    return [pick(keys), ...Array.from({ length: length - 1 }, () => pick(nested))];
  };
  const binding = () => pick(bindings) ?? 'x';
  const value = () =>
    pick([
      () => 1,
      () => 'x',
      () => ['a'],
      () => ({ a: 1, b: { c: 'd' } }),
      () => parseExpression(`{ ...${binding()} }`),
      () => parseExpression('() => {\n  return 1;\n}'),
      () => parseExpression('{\n  a: 1,\n  b: [\n    2,\n  ],\n}'),
      () => parseExpression(binding()),
      () => parseExpression(`${binding()}.args`),
    ])();
  const { trace, record, op } = tracer(() => printCsf(csf).code);
  const mutate = (object: CsfObject) => {
    const target = path();
    const who = JSON.stringify(object.target);
    const result = pick([
      () => (op('set', who, target), object.set(target, value())),
      () => (op('refused', who), object.set(['__proto__'], 1)),
      () => (op('remove', who, target), object.remove(target)),
      () => (op('append', who, target), object.append(target, value())),
      () => (op('prepend', who, target), object.prepend(target, value())),
      () => (op('rename', who, target), object.rename(target, pick(['a', 'b', 'renamed', 'args']))),
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
      () => {
        const names = [pick(nested), pick(nested)].filter((name) => typeof name === 'string');
        op('group', who, [target[0], 'g'], names);
        return object.group([target[0], 'g'], names);
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
      () => {
        const { node } = object;
        return node ? textOf(node) : null;
      },
    ])();
  };
  const specifier = () => [pick(['expect', 'fn', 'userEvent'])];
  for (let step = 0; step < 40; step++) {
    const object = pick(objects);
    const kind = random();
    if (kind < 0.5) {
      record('mutate', () => mutate(object));
    } else if (kind < 0.7) {
      record('read', () => read(object));
    } else if (kind < 0.8) {
      record('transaction', () =>
        csf.transaction(() => {
          mutate(object);
          mutate(pick(objects));
          return random() < 0.7;
        })
      );
    } else if (kind < 0.83) {
      record('raw', () => appendStatement(csf.editor, `${pick(objects).target.kind}Extra();`));
    } else if (kind < 0.86) {
      record('raw', () => {
        const { node } = object;
        if (node) {
          appendMembers(csf.editor, node, [`raw: ${binding()}`]);
        }
      });
    } else if (kind < 0.9) {
      record('import', () => csf.setImport(specifier(), 'storybook/test'));
    } else if (kind < 0.93) {
      record('unimport', () => csf.removeImport(specifier(), 'storybook/test'));
    } else if (kind < 0.97) {
      record('stories', () => csf.stories);
    } else {
      record('commit', () => {
        csf.editor.commit();
      });
    }
  }
  record('diagnostics', () => csf.mutationDiagnostics);
  record('index', () => csf.indexInputs);
  record('changed', () => [csf.changed, ...objects.map((object) => object.changed)]);
  return trace;
};

// The same for a config file, with its own readers and array helpers.
const replayConfig = (code: string, seed: number, eager: boolean) => {
  const { random, pick } = randomOf(seed);
  const config = loadConfig(code, 'main.ts').parse();
  const keys = ['addons', 'framework', 'tags', 'parameters', 'stories', 'docs', 'core'];
  const nested = ['name', 'options', 'a', 'b', 0, 1];
  const path = (): CsfPath => [
    pick(keys),
    ...Array.from({ length: Math.floor(random() * 3) }, () => pick(nested)),
  ];
  const names = (target: CsfPath) => target.filter((key) => typeof key === 'string');
  const value = () =>
    pick([
      () => 1,
      () => 'x',
      () => ['a'],
      () => ({ name: 'n', options: { a: 1 } }),
      () => parseExpression('() => {\n  return 1;\n}'),
      () => parseExpression('{\n  a: 1,\n}'),
    ])();
  const { trace, record, op } = tracer(() => printConfig(config).code);
  const mutate = () => {
    const target = path();
    const result = pick([
      () => (op('set', target), config.set(target, value())),
      () => (op('remove', target), config.remove(target)),
      () => (op('append', target), config.append(target, value())),
      () => (op('prepend', target), config.prepend(target, value())),
      () => (op('rename', target), config.rename(target, pick(['a', 'b', 'renamed', 'addons']))),
      () => {
        const to = path();
        op('move', target, to);
        return config.move(target, to);
      },
      () => (op('group', target), config.group([target[0], 'g'], ['a', 'b', 'name'])),
      () => (
        op('transform', target),
        config.transform(target, (node) => parseExpression(`[${textOf(node)}]`))
      ),
      () => (op('appendValueToArray', target), config.appendValueToArray(names(target), 'z')),
      () => (op('removeEntryFromArray', target), config.removeEntryFromArray(names(target), 'a')),
    ])();
    if (eager && result?.ok) {
      config.editor.commit();
    }
    return result;
  };
  for (let step = 0; step < 30; step++) {
    const kind = random();
    if (kind < 0.5) {
      record('mutate', mutate);
    } else if (kind < 0.7) {
      const target = path();
      op('read', target);
      record('read', () =>
        pick([
          () => config.getValue(target),
          () => config.inspect(target),
          () => {
            const node = config.get(target);
            return node && textOf(node);
          },
          () => {
            const { node } = config;
            return node ? textOf(node) : null;
          },
          () => {
            const node = config.getFieldNode(names(target));
            return node ? textOf(node) : null;
          },
          () => config.getNamesFromPath(['addons']),
        ])()
      );
    } else if (kind < 0.8) {
      record('transaction', () =>
        config.transaction(() => {
          mutate();
          mutate();
          return random() < 0.7;
        })
      );
    } else if (kind < 0.84) {
      record('import', () => config.setImport([pick(['x', 'z'])], 'mod'));
    } else if (kind < 0.87) {
      record('require', () => config.setRequireImport([pick(['y', 'z'])], 'mod2'));
    } else if (kind < 0.89) {
      record('unimport', () => config.removeImport([pick(['x', 'y'])], pick(['mod', 'mod2'])));
    } else if (kind < 0.92) {
      record('raw', () => appendStatement(config.editor, 'extra();'));
    } else {
      record('commit', () => {
        config.editor.commit();
      });
    }
  }
  record('diagnostics', () => config.mutationDiagnostics);
  record('changed', () => config.changed);
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

  const sources: [string, string][] = [
    ...files.map((file): [string, string] => [file, readFileSync(join(inputs, file), 'utf8')]),
    ...Object.entries(hostile),
  ];

  it.each(sources)('mutates %s as a commit after every mutation does', (file, code) => {
    for (let seed = 1; seed <= seeds; seed++) {
      expect(replay(file, code, seed, false)).toEqual(replay(file, code, seed, true));
    }
  });

  it('makes every pair of writes that join or break lines as a commit after each does', () => {
    const load = () =>
      loadCsf(layout, { fileName: 'layout.stories.ts', makeTitle: (t) => t! }).parse();
    const writes = layoutWrites(load());
    const run = (pair: typeof writes, eager: boolean) => {
      const csf = load();
      const results = pair.map(({ index, run: write }) => {
        const result = write(csf.objects()[index]);
        if (eager && result.ok) {
          csf.editor.commit();
        }
        return result;
      });
      return { results, code: printCsf(csf).code };
    };
    const differ = writes.flatMap((first) =>
      writes
        .filter(
          (second) =>
            JSON.stringify(run([first, second], false)) !==
            JSON.stringify(run([first, second], true))
        )
        .map((second) => `${first.label}, then ${second.label}`)
    );
    expect(differ).toEqual([]);
  });

  it.each(Object.entries(configs))(
    'edits the %s config as a commit after every mutation does',
    (_, code) => {
      for (let seed = 1; seed <= seeds; seed++) {
        expect(replayConfig(code, seed, false)).toEqual(replayConfig(code, seed, true));
      }
    }
  );
});
