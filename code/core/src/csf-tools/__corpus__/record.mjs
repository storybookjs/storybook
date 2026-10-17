// Records golden outputs for the corpus from a Storybook checkout that still indexes with Babel.
//
//   node code/core/src/csf-tools/__corpus__/record.mjs <path-to-babel-checkout>/code
//
// The checkout must have `core` compiled. The summary written here mirrors `summarize` in
// `corpus.test.ts`, which runs the OXC implementation against the same inputs.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const checkout = resolve(process.argv[2]);
const require = createRequire(join(checkout, 'package.json'));
const { loadCsf } = await import(join(checkout, 'core/dist/csf-tools/index.js'));
const traverse = require('@babel/traverse').default;

const regexOrArray = (value) =>
  value instanceof RegExp ? { regex: value.source, flags: value.flags } : (value ?? null);

const summarize = (file, code) => {
  let csf;
  try {
    csf = loadCsf(code, { fileName: file, makeTitle: (title) => title ?? 'Untitled' }).parse();
  } catch {
    return { error: true };
  }
  const bindings = {};
  traverse(csf._ast, {
    Program(path) {
      for (const [name, binding] of Object.entries(path.scope.bindings)) {
        bindings[name] = {
          constant: binding.constant,
          uses: binding.referencePaths.length + binding.constantViolations.length,
        };
      }
      path.stop();
    },
  });
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

const inputs = join(here, 'inputs');
const golden = {};
for (const file of readdirSync(inputs).sort()) {
  golden[file] = summarize(file, readFileSync(join(inputs, file), 'utf8'));
}
writeFileSync(join(here, 'golden.json'), `${JSON.stringify(golden, null, 2)}\n`);
console.log(`recorded ${Object.keys(golden).length} files`);
