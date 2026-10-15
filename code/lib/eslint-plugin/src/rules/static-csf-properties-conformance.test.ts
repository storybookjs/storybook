import { loadCsf } from 'storybook/internal/csf-tools';

import tsParser from '@typescript-eslint/parser';
import { Linter } from 'eslint';
import { dedent } from 'ts-dedent';
import { describe, expect, it } from 'vitest';

import rule from './static-csf-properties.ts';

// The messages asserting "csf-tools cannot read this file"; divergence-only messages
// (spread order, key form) fire on files that still index and are tested separately.
const HARD_FAILURE_MESSAGES = [
  'dynamicProperty',
  'unresolvableFactoryMeta',
  'invalidPreviewImport',
];

const lintReportsHardFailure = (code: string) => {
  const linter = new Linter({ configType: 'flat' });
  const messages = linter.verify(
    code,
    {
      files: ['**/*.stories.ts'],
      languageOptions: { parser: tsParser, sourceType: 'module' },
      plugins: {
        storybook: { rules: { 'static-csf-properties': rule } },
      },
      rules: { 'storybook/static-csf-properties': 'error' },
    } as never,
    'Button.stories.ts'
  );
  const fatal = messages.find((message) => message.fatal);
  if (fatal) {
    throw new Error(`fixture does not parse: ${fatal.message}`);
  }
  return messages.some(
    (message) => message.messageId && HARD_FAILURE_MESSAGES.includes(message.messageId)
  );
};

const csfToolsCanIndex = (code: string) => {
  try {
    const csf = loadCsf(code, {
      makeTitle: (userTitle) => userTitle ?? 'Auto Title',
      fileName: 'Button.stories.ts',
    }).parse();
    return !csf._metaNodeIsSynthetic;
  } catch {
    return false;
  }
};

const fixtures: Array<{ name: string; code: string; indexable: boolean }> = [
  {
    name: 'fully static CSF3 meta',
    code: dedent`
      export default {
        title: 'Button',
        id: 'button-id',
        tags: ['autodocs'],
        includeStories: ['Primary'],
        excludeStories: /Data$/,
      }
      export const Primary = { tags: ['snapshot'] }
    `,
    indexable: true,
  },
  {
    name: 'title through a local constant',
    code: dedent`
      const TITLE = 'Button'
      export default { title: TITLE }
      export const Primary = {}
    `,
    indexable: true,
  },
  {
    name: 'title with satisfies',
    code: dedent`
      export default { title: 'Button' satisfies string }
    `,
    indexable: true,
  },
  {
    name: 'story tags through a local constant',
    code: dedent`
      const tags = ['snapshot']
      export default {}
      export const Primary = { tags }
    `,
    indexable: true,
  },
  {
    name: 'excluded exports can hold anything',
    code: dedent`
      export default { excludeStories: ['mockData'] }
      export const mockData = { tags: generateTags() }
      export const Primary = {}
    `,
    indexable: true,
  },
  {
    name: 'quoted keys are ignored by the indexer, not errors',
    code: dedent`
      export default { 'title': computeTitle() }
    `,
    indexable: true,
  },
  {
    name: 'dynamic title',
    code: dedent`
      export default { title: computeTitle() }
    `,
    indexable: false,
  },
  {
    name: 'template literal title',
    code: 'export default { title: `Button` }',
    indexable: false,
  },
  {
    name: 'imported title',
    code: dedent`
      import { TITLE } from './titles'
      export default { title: TITLE }
    `,
    indexable: false,
  },
  {
    name: 'id does not resolve local constants',
    code: dedent`
      const ID = 'button-id'
      export default { id: ID }
    `,
    indexable: false,
  },
  {
    name: 'tags with a spread element',
    code: dedent`
      export default { tags: [...base, 'autodocs'] }
    `,
    indexable: false,
  },
  {
    name: 'tags with an identifier element',
    code: dedent`
      const EXTRA = 'autodocs'
      export default { tags: ['dev', EXTRA] }
    `,
    indexable: false,
  },
  {
    name: 'includeStories does not resolve local constants',
    code: dedent`
      const included = ['Primary']
      export default { includeStories: included }
    `,
    indexable: false,
  },
  {
    name: 'dynamic story tags',
    code: dedent`
      export default {}
      export const Primary = { tags: generateTags() }
    `,
    indexable: false,
  },
  {
    name: 'dynamic title behind export { x as default }',
    code: dedent`
      const meta = { title: computeTitle() }
      export { meta as default }
    `,
    indexable: false,
  },
  {
    name: 'CSF4 inline meta',
    code: dedent`
      import preview from '../../.storybook/preview'
      const meta = preview.meta({ component: Button })
      export const Primary = meta.story({})
    `,
    indexable: true,
  },
  {
    name: 'CSF4 meta through a local constant',
    code: dedent`
      import preview from '../../.storybook/preview'
      const config = { component: Button }
      const meta = preview.meta(config)
      export const Primary = meta.story({})
    `,
    indexable: true,
  },
  {
    name: 'CSF4 meta from a call expression',
    code: dedent`
      import preview from '../../.storybook/preview'
      const meta = preview.meta(generateMeta())
      export const Primary = meta.story({})
    `,
    indexable: false,
  },
  {
    name: 'CSF4 meta from a reassigned variable',
    code: dedent`
      import preview from '../../.storybook/preview'
      let config = { component: Button }
      config = extend(config)
      const meta = preview.meta(config)
      export const Primary = meta.story({})
    `,
    indexable: false,
  },
  {
    name: 'CSF4 preview imported from a non-preview path',
    code: dedent`
      import preview from './local-config'
      const meta = preview.meta({ component: Button })
      export const Primary = meta.story({})
    `,
    indexable: false,
  },
  {
    name: 'CSF4 dynamic title in the meta object',
    code: dedent`
      import preview from '../../.storybook/preview'
      const meta = preview.meta({ title: computeTitle() })
      export const Primary = meta.story({})
    `,
    indexable: false,
  },
  {
    name: 'CSF4 dynamic story tags',
    code: dedent`
      import preview from '../../.storybook/preview'
      const meta = preview.meta({ component: Button })
      export const Primary = meta.story({ tags: computeTags() })
    `,
    indexable: false,
  },
];

describe('static-csf-properties conformance with csf-tools', () => {
  fixtures.forEach(({ name, code, indexable }) => {
    it(`${name} (${indexable ? 'indexable' : 'not indexable'})`, () => {
      expect(csfToolsCanIndex(code), 'csf-tools').toBe(indexable);
      expect(lintReportsHardFailure(code), 'rule hard failure').toBe(!indexable);
    });
  });
});
