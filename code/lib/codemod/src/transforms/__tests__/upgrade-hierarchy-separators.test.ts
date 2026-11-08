import { expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import transform from '../upgrade-hierarchy-separators.ts';

const run = (source: string) => transform({ source, path: 'Component.stories.js' });

it('rewrites the separators of a CSF title', () => {
  expect(
    run(dedent`
      export default {
        title: 'Foo|Bar/baz.whatever',
      };
    `)
  ).toBe(dedent`
    export default {
      title: 'Foo/Bar/baz/whatever',
    };
  `);
});

it('rewrites the separators of storiesOf and keeps the quotes as written', () => {
  expect(
    run(dedent`
      import { storiesOf } from '@storybook/react';

      storiesOf('A/B/C', module).add('abc', () => <div>hello</div>);
      storiesOf("D|E/f", module).add('d.e', () => <div>hello</div>);
    `)
  ).toBe(dedent`
    import { storiesOf } from '@storybook/react';

    storiesOf('A/B/C', module).add('abc', () => <div>hello</div>);
    storiesOf("D/E/f", module).add('d.e', () => <div>hello</div>);
  `);
});

it('rewrites the separators of a CSF title with a type assertion', () => {
  expect(run(`export default { title: 'a|b' } as Meta;`)).toBe(
    `export default { title: 'a/b' } as Meta;`
  );
});

it.each([
  ['an empty title', `export default { title: '' };`],
  ['a dynamic storiesOf kind', `const foo = 'a|b';\nstoriesOf(foo, module);`],
  ['a dynamic CSF title', `const title = 'a|b';\nexport default { title };`],
  [
    'a default export that is not an object',
    `const meta = { title: 'a|b' };\nexport default meta;`,
  ],
])('leaves %s alone', (_, source) => {
  expect(run(source)).toBe(source);
});
