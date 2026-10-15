import { loadCsf } from 'storybook/internal/csf-tools';

import { describe, expect, it } from 'vitest';

import { resolveStoryComponent } from './resolve-component.ts';

const csf = (source: string) => loadCsf(source, { makeTitle: () => 'Fixture' }).parse();

describe('resolveStoryComponent', () => {
  it.each([
    [
      'reads a string literal component',
      `export default { title: 'Fixture', component: 'x-string' };`,
      { tag: 'x-string' },
    ],
    [
      'reads a template literal without expressions',
      "export default { title: 'Fixture', component: `x-template` };",
      { tag: 'x-template' },
    ],
    [
      'reads a string literal with an as const assertion',
      `export default { title: 'Fixture', component: 'x-card' as const };`,
      { tag: 'x-card' },
    ],
    [
      'reads a string literal with a satisfies assertion',
      `export default { title: 'Fixture', component: 'x-card' satisfies string };`,
      { tag: 'x-card' },
    ],
    [
      'reads a parenthesized string literal',
      `export default { title: 'Fixture', component: ('x-card') };`,
      { tag: 'x-card' },
    ],
    [
      'reads a CSF4 factory string component',
      `
        import preview from './preview.ts';
        const meta = preview.meta({ title: 'Fixture', component: 'x-csf4' });
        export default meta;
        export const Basic = meta.story({});
      `,
      { tag: 'x-csf4' },
    ],
    [
      'reads a component spread from a local meta object',
      `const meta = { title: 'Fixture', component: 'x-tabs' }; export default { ...meta };`,
      { tag: 'x-tabs' },
    ],
    [
      'reads a spread component alongside other literal properties',
      `const meta = { component: 'x-tabs' }; export default { ...meta, tags: ['autodocs'] };`,
      { tag: 'x-tabs' },
    ],
    [
      'reads a spread meta object with a satisfies assertion',
      `const meta = { component: 'x-tabs' } satisfies Meta; export default { ...meta };`,
      { tag: 'x-tabs' },
    ],
    [
      'reads a spread meta object with an as assertion',
      `const meta = { component: 'x-tabs' } as Meta; export default { ...meta };`,
      { tag: 'x-tabs' },
    ],
    [
      'lets a literal component written after the spread win',
      `const meta = { component: 'x-old' }; export default { ...meta, component: 'x-new' };`,
      { tag: 'x-new' },
    ],
    [
      'lets a spread written after the literal component win',
      `const meta = { component: 'x-new' }; export default { component: 'x-old', ...meta };`,
      { tag: 'x-new' },
    ],
    [
      'reads a literal component next to an unreadable spread',
      `import { shared } from './shared.ts'; export default { component: 'x-tabs', ...shared };`,
      { tag: 'x-tabs' },
    ],
  ])('%s', (_name, source, expected) => {
    expect(resolveStoryComponent(csf(source))).toEqual(expected);
  });

  it.each([
    [
      'reports an identifier component',
      `const Button = 'x-button'; export default { title: 'Fixture', component: Button };`,
      { reason: 'component-not-a-tag', expression: 'Button' },
    ],
    [
      'reports a member expression component',
      `const tags = { button: 'x-button' }; export default { title: 'Fixture', component: tags.button };`,
      { reason: 'component-not-a-tag', expression: 'tags.button' },
    ],
    [
      'reports an empty string literal component',
      `export default { title: 'Fixture', component: '' };`,
      { reason: 'component-not-a-tag', expression: "''" },
    ],
    [
      'reports an identifier component wrapped in an as assertion',
      `const Button = 'x-button'; export default { title: 'Fixture', component: Button as any };`,
      { reason: 'component-not-a-tag', expression: 'Button as any' },
    ],
    [
      'reports a non-tag component reached through a spread',
      `const Button = 'x-button'; const meta = { component: Button }; export default { ...meta };`,
      { reason: 'component-not-a-tag', expression: 'Button' },
    ],
    [
      'reports a spread of an imported meta',
      `import { meta } from './meta.ts'; export default { ...meta, tags: ['autodocs'] };`,
      { reason: 'unresolvable-meta-spread', spread: '...meta' },
    ],
    [
      'reports a spread of a call',
      `export default { ...makeMeta('x-tabs') };`,
      { reason: 'unresolvable-meta-spread', spread: "...makeMeta('x-tabs')" },
    ],
    [
      'reports a spread of a local binding that is not an object literal',
      `const meta = makeMeta(); export default { ...meta };`,
      { reason: 'unresolvable-meta-spread', spread: '...meta' },
    ],
  ])('%s', (_name, source, expected) => {
    expect(resolveStoryComponent(csf(source))).toEqual(expected);
  });

  it.each([
    ['a meta without component', `export default { title: 'Fixture' };`],
    [
      'a local spread without component',
      `const meta = { title: 'Fixture' }; export default { ...meta };`,
    ],
  ])('reports no component for %s', (_name, source) => {
    expect(resolveStoryComponent(csf(source))).toEqual({ reason: 'no-meta-component' });
  });
});
