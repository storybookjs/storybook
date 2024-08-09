import { expect, it } from 'vitest';

import { rewriteImport } from './external-globals-plugin';

const packageName = '@storybook/package';
const globals = { [packageName]: '_STORYBOOK_PACKAGE_' };

const cases = [
  {
    globals,
    packageName,
    input: `import { Rain, Jour as Day, Nuit as Night, Sun } from "${packageName}"`,
    output: `const { Rain, Jour: Day, Nuit: Night, Sun } = ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import * as Foo from "${packageName}"`,
    output: `const Foo = ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import Foo from "${packageName}"`,
    output: `const {default: Foo} = ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import{Rain,Jour as Day,Nuit as Night,Sun}from'${packageName}'`,
    output: `const {Rain,Jour: Day,Nuit: Night,Sun} =${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `const { Afternoon } = await import('${packageName}')`,
    output: `const { Afternoon } = ${globals[packageName]}`,
  },
];

it('rewriteImport', () => {
  cases.forEach(({ input, output, globals: caseGlobals, packageName: casePackage }) => {
    expect(rewriteImport(input, caseGlobals, casePackage)).toStrictEqual(output);
  });
});
