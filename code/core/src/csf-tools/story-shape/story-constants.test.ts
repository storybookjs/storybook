import { describe, expect, it } from 'vitest';

import { loadCsf } from '../CsfFile.ts';
import { textOf, unwrapExpression } from '../estree/ast.ts';
import { createStoryArgsResolver } from './resolve-story-args.ts';
import { collectStoryConstants } from './story-constants.ts';

const storyConstantsOf = (code: string, taken?: string[], fileName = 'entry.tsx', jsx = false) => {
  const csf = loadCsf(`${code}\nexport default {};\nexport const Story = { args: { v } };`, {
    makeTitle: () => 'Example',
    fileName,
  }).parse();
  const resolver = createStoryArgsResolver(csf);
  const { args } = resolver.resolve('Story');
  return {
    value: args.v,
    constants: collectStoryConstants(args, resolver.ctx, { taken: new Set(taken), jsx }),
  };
};

const constantsOf = (...options: Parameters<typeof storyConstantsOf>) => {
  const { constants } = storyConstantsOf(...options);
  return Object.fromEntries(
    [...constants.names].map((name) => [name, textOf(constants.declarations.get(name)!.value)])
  );
};

describe('collectStoryConstants', () => {
  it('collects the constants a value reads, and those they read', () => {
    expect(
      constantsOf(
        `const SEP = '\\n';\nconst lines = ['a', 'b'];\nconst v = \`<pre>\${lines.join(SEP)}</pre>\`.length;`
      )
    ).toEqual({ SEP: `'\\n'`, lines: `['a', 'b']` });
  });

  it('collects a component a constant renders', () => {
    expect(
      constantsOf(
        `const Icon = () => <b />;\nconst renderIcon = () => <Icon />;\nconst v = renderIcon();`
      )
    ).toEqual({ Icon: '() => <b />', renderIcon: '() => <Icon />' });
  });

  it('keeps the as const a constant is written with', () => {
    expect(constantsOf(`const sizes = ['sm', 'lg'] as const;\nconst v = sizes[0];`)).toEqual({
      sizes: `['sm', 'lg'] as const`,
    });
  });

  it('keeps an as const written before satisfies', () => {
    expect(
      constantsOf(
        `const sizes = ['sm', 'lg'] as const satisfies readonly string[];\nconst v = sizes[0];`
      )
    ).toEqual({ sizes: `['sm', 'lg'] as const satisfies readonly string[]` });
  });

  it('declares nothing for a value holding an angle-bracket assertion', () => {
    expect(
      constantsOf(`const sizes = [<string>'sm'];\nconst v = sizes[0];`, [], 'entry.ts', true)
    ).toEqual({});
  });

  it('declares nothing for a generic arrow written outside a TSX file', () => {
    expect(
      constantsOf(`const id = <T>(x: T) => x;\nconst v = id(1);`, [], 'entry.ts', true)
    ).toEqual({});
  });

  it('leaves out an angle-bracket assertion, which JSX cannot hold', () => {
    expect(
      constantsOf(`const sizes = <const>['sm', 'lg'];\nconst v = sizes[0];`, [], 'entry.ts', true)
    ).toEqual({
      sizes: `['sm', 'lg']`,
    });
  });

  it('leaves out every type wrapper around an angle-bracket assertion', () => {
    expect(
      constantsOf(
        `const sizes = <const>['sm'] satisfies readonly string[];\nconst v = sizes[0];`,
        [],
        'entry.ts',
        true
      )
    ).toEqual({ sizes: `['sm']` });
  });

  it('collects a constant whose keys share the name of a type or an enum', () => {
    expect(
      constantsOf(
        `interface Theme {}\nenum Size { Sm = 'sm' }\nconst tokens = { Theme: 'dark', Size: 'sm' };\nconst v = tokens.Theme;`
      )
    ).toEqual({ tokens: `{ Theme: 'dark', Size: 'sm' }` });
  });

  it('keeps an angle-bracket assertion for a snippet that is not TSX', () => {
    expect(
      constantsOf(`const sizes = <const>['sm', 'lg'];\nconst v = sizes[0];`, [], 'entry.ts')
    ).toEqual({ sizes: `<const>['sm', 'lg']` });
  });

  it('gives the constants a value reads, or none when one cannot be declared', () => {
    const declared = storyConstantsOf(`const lines = ['a'];\nconst v = lines.length;`);
    expect([...declared.constants.readBy(declared.value)]).toEqual(['lines']);

    const dropped = storyConstantsOf(
      `import { theme } from './theme';\nconst lines = ['a'];\nconst v = theme + lines.length;`
    );
    expect([...dropped.constants.readBy(dropped.value)]).toEqual([]);
  });

  it.each([
    ['as written', `const lines = ['a'];\nconst v = lines.length;`],
    ['with as const', `const lines = ['a'] as const;\nconst v = lines.length;`],
  ])('names the constant a declared value belongs to, %s', (_what, code) => {
    const { constants } = storyConstantsOf(code);
    const { value } = constants.declarations.get('lines')!;
    expect(constants.declaredAs(value)).toBe('lines');
    expect(constants.declaredAs(unwrapExpression(value))).toBe('lines');
  });

  it('collects the key a parameter pattern reads', () => {
    expect(
      constantsOf(`const KEY = 'a';\nconst pick = ({ [KEY]: x }) => x;\nconst v = pick({ a: 1 });`)
    ).toEqual({ KEY: `'a'`, pick: '({ [KEY]: x }) => x' });
  });

  it('reads a global the story file declares over as its own', () => {
    expect(constantsOf(`const Math = { label: 'custom' };\nconst v = Math.label;`)).toEqual({
      Math: `{ label: 'custom' }`,
    });
  });

  it.each([
    ['a name the snippet takes', `const ref = { current: 1 };\nconst v = ref.current;`, ['ref']],
    [
      'a type of the story file',
      `interface Item { id: number }\nconst items = [] as Item[];\nconst v = items.length;`,
      [],
    ],
    [
      'a constant that reads itself',
      `const fact = (n) => (n ? n * fact(n - 1) : 1);\nconst v = fact(3);`,
      [],
    ],
    [
      'a component it renders that the snippet cannot declare',
      `import { Icon } from './Icon';\nconst renderIcon = () => <Icon />;\nconst v = renderIcon();`,
      [],
    ],
    [
      'an enum',
      `enum Kind { Primary = 'primary' }\nconst readKind = () => Kind.Primary;\nconst v = readKind();`,
      [],
    ],
    [
      'a type named outside ASCII',
      `type Größe = 'sm' | 'lg';\nconst size = 'sm' as Größe;\nconst v = size;`,
      [],
    ],
    ['a type imported inline', `const opt = 'a' as import('./types').Opt;\nconst v = [opt];`, []],
    [
      'an import',
      `import { theme } from './theme';\nconst size = theme.size;\nconst v = size;`,
      [],
    ],
  ])('declares nothing for a value that reads %s', (_what, code, taken) => {
    expect(constantsOf(code, taken)).toEqual({});
  });
});
