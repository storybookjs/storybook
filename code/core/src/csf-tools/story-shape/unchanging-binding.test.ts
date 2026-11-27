import { describe, expect, it } from 'vitest';

import { SourceEditor } from '../estree/editor.ts';
import { isVisiblyChanged, unchangingKind } from './unchanging-binding.ts';

const bindingOf = (code: string, name = 'lines') => {
  const editor = new SourceEditor(code, 'entry.ts');
  editor.parentOf(editor.program);
  return {
    binding: editor.scopes.program.bindings.get(name)!,
    ctx: { editor, filePath: 'entry.ts' },
  };
};

const kindOf = (code: string, name = 'lines') => {
  const { binding, ctx } = bindingOf(code, name);
  return unchangingKind(binding, ctx);
};

describe('unchangingKind', () => {
  it.each([
    ['a primitive', `const lines = 'a';`, 'primitive'],
    ['a function', `const lines = () => 1;`, 'function'],
    ['an array of primitives', `const lines = ['a', 'b'];`, 'flat'],
    [
      'an array read in a type, an argTypes option and a play function',
      `const lines = ['a'] as const;
type Line = (typeof lines)[number];
export default { argTypes: { line: { options: lines } } };
export const S = { play: async () => { await expect(lines.map((l) => l.trim())).toHaveLength(1); } };`,
      'flat',
    ],
    [
      'an array given to a CSF factory meta and story',
      `import preview from '#.storybook/preview';\nconst lines = ['a'];\nconst meta = preview.meta({ args: { lines } });\nexport const S = meta.story({ args: { n: lines.length } });`,
      'flat',
    ],
    [
      'an array given to a story of a typed CSF factory meta',
      `import preview from '#.storybook/preview';\nconst lines = ['a'];\nconst meta = preview.meta({});\nconst typed = meta.type<{ args: { n: number } }>();\nexport const S = typed.story({ args: { lines } });`,
      'flat',
    ],
    [
      'an array a CSF factory story holds, which a test runs',
      `import preview from '#.storybook/preview';\nconst lines = ['a'];\nconst meta = preview.meta({ args: { lines } });\nexport const S = meta.story({});\nS.test('x', async () => {});`,
      'flat',
    ],
    [
      'an array an imported expect reads',
      `import { expect } from 'storybook/test';\nconst lines = ['a'];\nexport const S = { play: async () => { await expect(lines).toHaveLength(1); } };`,
      'flat',
    ],
  ])('accepts %s', (_what, code, kind) => {
    expect(kindOf(code)).toBe(kind);
  });

  it.each([
    ['holds objects', `const lines = [{ id: 1 }];`],
    ['is declared with var', `var lines = ['a'];`],
    ['is built by a call', `const lines = new Map();`],
    ['is changed by a method', `const lines = ['a'];\nlines.push('b');`],
    [
      'is changed by a destructuring assignment',
      `const lines = ['a', 'b'];\n[lines[0], lines[1]] = [lines[1], lines[0]];`,
    ],
    [
      'is changed through a function returning it',
      `const lines = ['a'];\nconst get = () => lines;\nget().push('b');`,
    ],
    ['is handed to a template tag', `const lines = ['a'];\nconst out = tag\`\${lines}\`;`],
    ['is handed to an unknown function', `const lines = ['a'];\ngrow(lines);`],
    ['is given another name', `const lines = ['a'];\nconst alias = lines;`],
    ['is a function given a property', `const lines = () => 1;\nlines.prefix = 'a';`],
    [
      'is handed to a callback that takes the array',
      `const lines = ['a'];\nlines.forEach((line, i, all) => { all[i] = line.toUpperCase(); });`,
    ],
    ['is handed to a named callback', `const lines = ['a'];\nlines.forEach(grow);`],
    [
      'is handed to a callback that reaches it through arguments',
      `const lines = ['a'];\nlines.forEach(function () { arguments[2].push('b'); });`,
    ],
    [
      'is handed to a nested function declared under a reading name',
      `const lines = ['a'];\n{\n  const expect = (x) => x.push('b');\n  expect(lines);\n}`,
    ],
    [
      'is given to a CSF factory meta whose args are changed',
      `import preview from '#.storybook/preview';\nconst lines = ['a'];\nconst meta = preview.meta({ args: { lines } });\nmeta.input.args.lines.push('b');\nexport const S = meta.story({});`,
    ],
    [
      'is handed to a function the file declares under a reading name',
      `const lines = ['a'];\nconst expect = (x) => x;\nexpect(lines).push('b');`,
    ],
    [
      'a helper holds, whose own run method can change it',
      `const lines = ['a'];\nconst helper = { lines, run() {} };\nhelper.run();\nexport const S = { args: { lines } };`,
    ],
    [
      'is given to a meta method that is not a CSF factory',
      `import { analytics } from './analytics';\nconst lines = ['a'];\nexport const tracked = analytics.meta({ args: { lines } });`,
    ],
  ])('rejects a binding that %s', (_what, code) => {
    expect(kindOf(code)).toBeUndefined();
  });
});

describe('isVisiblyChanged', () => {
  it.each([
    ['a write', `let count = 0;\ncount += 1;`],
    ['a method that changes it', `const count = [];\ncount.push(1);`],
    ['a method written with brackets', `const count = [];\ncount['push'](1);`],
    [
      'a method only known at runtime',
      `const count = [];\nconst method = 'push';\ncount[method](1);`,
    ],
    ['a change through another name', `const count = [];\nconst alias = count;\nalias.push(1);`],
  ])('sees %s', (_what, code) => {
    const { binding, ctx } = bindingOf(code, 'count');
    expect(isVisiblyChanged(binding, ctx)).toBe(true);
  });

  it('leaves a value alone when a copy of it is given a new one', () => {
    const { binding, ctx } = bindingOf(`const count = 0;\nlet copy = count;\ncopy = 1;`, 'count');
    expect(isVisiblyChanged(binding, ctx)).toBe(false);
  });
});
