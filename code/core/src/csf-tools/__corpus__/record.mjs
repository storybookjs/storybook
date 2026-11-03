// Records golden outputs for the corpus from a Storybook checkout with `core` compiled.
//
//   node code/core/src/csf-tools/__corpus__/record.mjs index <path-to-babel-checkout>/code
//   node code/core/src/csf-tools/__corpus__/record.mjs transforms [<path-to-checkout>/code]
//
// `index` writes `golden.json` from a checkout that still indexes with Babel; its summary mirrors
// `summarize` in `corpus.test.ts`. `transforms` writes `transforms.json` with the summary the test
// shares from `summarize.ts`, from this checkout unless another is given.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';

import { summarizeTransforms } from './summarize.ts';

const here = dirname(fileURLToPath(import.meta.url));
const [mode, checkoutPath] = process.argv.slice(2);
if (mode !== 'transforms' && (mode !== 'index' || !checkoutPath)) {
  throw new Error('Usage: record.mjs index <babel-checkout>/code | transforms [<checkout>/code]');
}
const checkout = checkoutPath ? resolve(checkoutPath) : join(here, '../../../..');
const require = createRequire(join(checkout, 'package.json'));
const csfTools = await import(join(checkout, 'core/dist/csf-tools/index.js'));

const regexOrArray = (value) =>
  value instanceof RegExp ? { regex: value.source, flags: value.flags } : (value ?? null);

const summarizeIndex = (file, code) => {
  const traverse = require('@babel/traverse').default;
  let csf;
  try {
    csf = csfTools
      .loadCsf(code, { fileName: file, makeTitle: (title) => title ?? 'Untitled' })
      .parse();
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
const recorded = {};
for (const file of readdirSync(inputs).sort()) {
  const code = readFileSync(join(inputs, file), 'utf8');
  recorded[file] =
    mode === 'index'
      ? summarizeIndex(file, code)
      : await summarizeTransforms({ csfTools, format }, inputs, file, code);
}
const output = mode === 'index' ? 'golden.json' : 'transforms.json';
writeFileSync(join(here, output), `${JSON.stringify(recorded, null, 2)}\n`);
console.log(`recorded ${Object.keys(recorded).length} files in ${output}`);
