// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { SourceEditor, isVisiblyChanged } from 'storybook/internal/csf-tools';

import { runsWhileLoading } from './runs-while-loading.ts';

const changedWhileLoading = (code: string) => {
  const editor = new SourceEditor(code, 'entry.ts');
  editor.parentOf(editor.program);
  const binding = editor.scopes.program.bindings.get('count')!;
  return isVisiblyChanged(binding, { editor, filePath: 'entry.ts' }, (reference) =>
    runsWhileLoading(reference, editor)
  );
};

describe('runsWhileLoading', () => {
  it.each([
    ['a change the script makes', `let count = 0;\ncount += 1;`],
    [
      'a change a function the script calls makes',
      `let count = 0;\nfunction init() { count = 2; }\ninit();`,
    ],
    [
      'a change two calls deep',
      `let count = 0;\nfunction bump() { count = 5; }\nfunction init() { bump(); }\ninit();`,
    ],
    [
      'a change a callback the script runs makes',
      `let count = 0;\n[1].forEach(() => { count = 2; });`,
    ],
    [
      'a change a function handed to forEach makes',
      `let count = 0;\nfunction add() { count += 1; }\n['a'].forEach(add);`,
    ],
    [
      'a change Storybook makes before render',
      `let count = 0;\nfunction setup() { count = 2; }\nexport default { beforeEach: setup };`,
    ],
    [
      'a change a before-render arrow calls',
      `let count = 0;\nfunction reset() { count = 5; }\nexport default { beforeEach: () => { reset(); } };`,
    ],
    [
      'a change behind a type assertion',
      `let count = 0;\nconst bump = (() => { count += 1; }) as () => void;\nbump();`,
    ],
    [
      'a change a returned function makes',
      `let count = 0;\nfunction make() { return () => { count += 1; }; }\nmake()();`,
    ],
    [
      'a change a nested function handed to a call makes',
      `let count = 0;\nfunction setup() { const bump = () => { count += 1; }; untrack(bump); }\nsetup();`,
    ],
    [
      'a change a function called through call makes',
      `let count = 0;\nfunction bump() { count += 1; }\nbump.call(null);`,
    ],
    ['a store update', `const count = writable(0);\ncount.update((n) => n + 1);`],
  ])('counts %s', (_what, code) => {
    expect(changedWhileLoading(code)).toBe(true);
  });

  it.each([
    [
      'a change only an event handler makes',
      `let count = 0;\nfunction increment() { count += 1; }`,
    ],
    ['a change onMount makes', `let count = 0;\nonMount(() => { count = 2; });`],
    [
      'a change a callback inside onMount makes',
      `let count = 0;\nonMount(() => { [1].forEach((n) => { count += n; }); });`,
    ],
    [
      'a change a function handed to forEach inside onMount makes',
      `let count = 0;\nfunction add() { count += 1; }\nonMount(() => { [1].forEach(add); });`,
    ],
    [
      'a change a spied function makes',
      `let count = 0;\nfunction inc() { count += 1; }\nconst onclick = fn(inc);`,
    ],
    [
      'a change a handler in defineMeta args makes',
      `let count = 0;\nconst { Story } = defineMeta({ args: { onclick: () => count++ } });`,
    ],
  ])('leaves out %s', (_what, code) => {
    expect(changedWhileLoading(code)).toBe(false);
  });
});
