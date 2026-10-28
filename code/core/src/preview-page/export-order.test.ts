import { expect, it } from 'vitest';

import { appendNamedExportsOrder } from './export-order.ts';

it.each([
  {
    name: 'ES named exports in source order',
    input: 'export default {};\nexport const Primary = {};\nexport const Secondary = {};',
    expected:
      'export default {};\nexport const Primary = {};\nexport const Secondary = {};;export const __namedExportsOrder = ["Primary","Secondary"];',
  },
  {
    name: 'renamed and re-exported stories',
    input: "const A = {};\nexport { A as First };\nexport { B } from './b';\nexport default {};",
    expected:
      'const A = {};\nexport { A as First };\nexport { B } from \'./b\';\nexport default {};;export const __namedExportsOrder = ["First","B"];',
  },
  {
    name: 'an ES module with only a default export',
    input: 'export default {};',
    expected: 'export default {};;export const __namedExportsOrder = [];',
  },
  {
    name: 'an ES module that declares its own order',
    input: "export const A = {};\nexport const __namedExportsOrder = ['A'];",
    expected: undefined,
  },
  {
    name: 'CommonJS exports',
    input:
      'Object.defineProperty(exports, "__esModule", { value: true });\nexports.default = {};\nexports.Primary = {};',
    expected:
      'Object.defineProperty(exports, "__esModule", { value: true });\nexports.default = {};\nexports.Primary = {};;module.exports.__namedExportsOrder = ["Primary"];',
  },
  {
    name: 'CommonJS that declares its own order',
    input: "exports.Primary = {};\nexports.__namedExportsOrder = ['Primary'];",
    expected: undefined,
  },
  {
    name: 'a script without exports',
    input: 'window.story = {};',
    expected: undefined,
  },
])('appends the order of $name', async ({ input, expected }) => {
  const result = await appendNamedExportsOrder(input, 'Button.stories.js');
  expect(result?.code).toBe(expected);
});

it('maps the appended code back to the source', async () => {
  const result = await appendNamedExportsOrder('export const A = {};', 'A.stories.js');
  expect(result?.map.sources).toEqual(['A.stories.js']);
});
