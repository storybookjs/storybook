import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import { resolveStoryComponent } from './resolve-component.ts';

vi.mock('node:fs', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
});

const STORY_PATH = '/workspace/input.stories.ts';

const givenStory = (source: string) => {
  vol.fromNestedJSON({ [STORY_PATH]: source });
};

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
  ])('%s', (_name, source, expected) => {
    givenStory(source);

    expect(resolveStoryComponent(STORY_PATH)).toEqual(expected);
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
  ])('%s', (_name, source, expected) => {
    givenStory(source);

    expect(resolveStoryComponent(STORY_PATH)).toEqual(expected);
  });

  it('reports no component for missing meta.component', () => {
    givenStory(`export default { title: 'Fixture' };`);

    expect(resolveStoryComponent(STORY_PATH)).toEqual({ reason: 'no-meta-component' });
  });
});
