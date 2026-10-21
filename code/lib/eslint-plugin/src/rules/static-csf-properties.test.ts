import { loadCsf } from 'storybook/internal/csf-tools';

import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { TSESLint } from '@typescript-eslint/utils';
import { dedent } from 'ts-dedent';
import { describe, expect, it } from 'vitest';

import ruleTester from '../test-utils.ts';
import rule from './static-csf-properties.ts';

type MessageIds = keyof typeof rule.meta.messages;

// Each scenario is asserted twice: the rule must produce exactly `errors`, and csf-tools'
// CsfFile must agree on `indexable` — so the rule cannot drift from what the indexer accepts.
interface Scenario {
  name: string;
  code: string;
  /** Whether csf-tools indexes the file without throwing or falling back to an empty meta. */
  indexable: boolean;
  errors?: TSESLint.TestCaseError<MessageIds>[];
}

const scenarios: Scenario[] = [
  {
    name: 'fully static meta and story properties',
    code: dedent`
      export default {
        title: 'Button',
        id: 'button-id',
        tags: ['autodocs', '!dev'],
        includeStories: ['Primary'],
        excludeStories: /Data$/,
      }
      export const Primary = { tags: ['snapshot'] }
    `,
    indexable: true,
  },
  {
    name: 'includeStories as a string literal',
    code: "export default { includeStories: 'Primary' }",
    indexable: true,
  },
  {
    name: 'title through a top-level constant',
    code: dedent`
      const TITLE = 'Atoms/Button'
      export default { title: TITLE }
    `,
    indexable: true,
  },
  {
    name: 'title through a satisfies-wrapped constant',
    code: dedent`
      const TITLE = 'Atoms/Button' satisfies string
      export default { title: TITLE }
    `,
    indexable: true,
  },
  {
    name: 'inline satisfies-wrapped title',
    code: "export default { title: 'Button' satisfies string }",
    indexable: true,
  },
  {
    name: 'tags through a shorthand constant',
    code: dedent`
      const tags = ['autodocs']
      export default { tags }
    `,
    indexable: true,
  },
  {
    name: 'statically read properties placed after a spread',
    code: "export default { ...baseMeta, title: 'Button', tags: ['autodocs'] }",
    indexable: true,
  },
  {
    name: 'spread position only matters for statically read properties',
    code: "export default { args: { primary: true }, ...baseArgs, title: 'Button' }",
    indexable: true,
  },
  {
    name: 'story tags through a top-level constant',
    code: dedent`
      const tags = ['snapshot']
      export default {}
      export const Primary = { tags }
    `,
    indexable: true,
  },
  {
    name: 'excluded exports are not indexed and stay unconstrained',
    code: dedent`
      export default { component: Button, excludeStories: ['mockData'] }
      export const mockData = { tags: generateTags() }
      export const Primary = {}
    `,
    indexable: true,
  },
  {
    name: 'keys inherited from Object.prototype are not static properties',
    code: dedent`
      export default { constructor: Button }
      export const Primary = { toString() { return 'Primary' } }
    `,
    indexable: true,
  },
  {
    name: 'static tags assigned after the story declaration',
    code: dedent`
      export default {}
      export const Primary = {}
      Primary.tags = ['snapshot']
    `,
    indexable: true,
  },
  {
    name: 'tags assigned before the declaration are ignored by the indexer',
    code: dedent`
      Primary.tags = generateTags()
      export default {}
      export const Primary = {}
    `,
    indexable: true,
  },
  {
    name: 'CSF4 factory with inline meta and story objects',
    code: dedent`
      import preview from '../../.storybook/preview'
      const meta = preview.meta({ title: 'Button', tags: ['autodocs'] })
      export const Primary = meta.story({ tags: ['snapshot'] })
    `,
    indexable: true,
  },
  {
    name: 'CSF4 meta through a constant',
    code: dedent`
      import preview from '../../.storybook/preview'
      const config = { title: 'Button' }
      const meta = preview.meta(config)
      export const Primary = meta.story({})
    `,
    indexable: true,
  },
  {
    name: 'CSF4 chained factory call',
    code: dedent`
      import preview from '../../.storybook/preview'
      const meta = preview.type().meta({ title: 'Button' })
      export const Primary = meta.story({})
    `,
    indexable: true,
  },
  {
    name: 'member .meta() calls unrelated to Storybook are ignored',
    code: dedent`
      import { z } from 'zod'
      export default { component: Button }
      const schema = z.string().meta({ title: computeTitle() })
    `,
    indexable: true,
  },
  {
    name: 'dynamic title',
    code: 'export default { title: getTitle() }',
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'template literal title',
    code: 'export default { title: `Button/${suffix}` }',
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'imported title',
    code: dedent`
      import { TITLE } from './titles'
      export default { title: TITLE }
    `,
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'id does not resolve constants',
    code: dedent`
      const ID = 'button-id'
      export default { id: ID }
    `,
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'tags with a spread element',
    code: "export default { tags: [...baseTags, 'autodocs'] }",
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'tags with an identifier element',
    code: dedent`
      const EXTRA = 'autodocs'
      export default { tags: ['dev', EXTRA] }
    `,
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'includeStories does not resolve constants',
    code: dedent`
      const included = ['Primary']
      export default { includeStories: included }
    `,
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'static title before a spread can be overridden at runtime',
    code: "export default { title: 'Button', ...baseMeta }",
    indexable: true,
    errors: [
      {
        messageId: 'propertyBeforeSpread',
        type: AST_NODE_TYPES.Property,
        suggestions: [
          {
            messageId: 'movePropertyAfterSpread',
            data: { property: 'title' },
            output: "export default {  ...baseMeta, title: 'Button' }",
          },
        ],
      },
    ],
  },
  {
    name: 'quoted keys are silently ignored by the indexer',
    code: "export default { 'title': 'Button' }",
    indexable: true,
    errors: [
      {
        messageId: 'ignoredKey',
        type: AST_NODE_TYPES.Literal,
        suggestions: [
          {
            messageId: 'useIdentifierKey',
            output: "export default { title: 'Button' }",
          },
        ],
      },
    ],
  },
  {
    name: 'computed string keys are silently ignored by the indexer',
    code: "export default { ['title']: 'Button' }",
    indexable: true,
    errors: [{ messageId: 'ignoredKey', type: AST_NODE_TYPES.Literal }],
  },
  {
    name: 'computed identifier keys are misread as the static property',
    code: dedent`
      const title = 'parameters'
      export default { [title]: { layout: 'fullscreen' } }
    `,
    indexable: false,
    errors: [{ messageId: 'misreadComputedKey', type: AST_NODE_TYPES.Identifier }],
  },
  {
    name: 'dynamic story tags',
    code: dedent`
      export default { component: Button }
      export const Primary = { tags: generateTags() }
    `,
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'static story tags before a spread',
    code: dedent`
      export default { component: Button }
      export const Primary = { tags: ['snapshot'], ...sharedStory }
    `,
    indexable: true,
    errors: [
      {
        messageId: 'propertyBeforeSpread',
        type: AST_NODE_TYPES.Property,
        suggestions: [
          {
            messageId: 'movePropertyAfterSpread',
            data: { property: 'tags' },
            output: dedent`
              export default { component: Button }
              export const Primary = {  ...sharedStory, tags: ['snapshot'] }
            `,
          },
        ],
      },
    ],
  },
  {
    name: 'dynamic tags on a story exported through a specifier',
    code: dedent`
      const story = { tags: makeTags() }
      export default { component: Button }
      export { story as Primary }
    `,
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'dynamic title behind export { x as default }',
    code: dedent`
      const meta = { title: getTitle() }
      export { meta as default }
    `,
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'dynamic tags assigned after the story declaration',
    code: dedent`
      export default {}
      export const Primary = {}
      Primary.tags = generateTags()
    `,
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.AssignmentExpression }],
  },
  {
    name: 'CSF4 dynamic title',
    code: dedent`
      import preview from '../../.storybook/preview'
      const meta = preview.meta({ title: getTitle() })
      export const Primary = meta.story({})
    `,
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'CSF4 meta from a call expression',
    code: dedent`
      import preview from '../../.storybook/preview'
      const meta = preview.meta(generateMeta())
      export const Primary = meta.story({})
    `,
    indexable: false,
    errors: [{ messageId: 'unresolvableFactoryMeta', type: AST_NODE_TYPES.CallExpression }],
  },
  {
    name: 'CSF4 meta from a reassigned variable',
    code: dedent`
      import preview from '../../.storybook/preview'
      let config = { title: 'Button' }
      config = extend(config)
      const meta = preview.meta(config)
      export const Primary = meta.story({})
    `,
    indexable: false,
    errors: [{ messageId: 'unresolvableFactoryMeta', type: AST_NODE_TYPES.Identifier }],
  },
  {
    name: 'CSF4 preview imported from a non-preview path',
    code: dedent`
      import preview from './local-config'
      const meta = preview.meta({ component: Button })
      export const Primary = meta.story({})
    `,
    indexable: false,
    errors: [{ messageId: 'invalidPreviewImport', type: AST_NODE_TYPES.CallExpression }],
  },
  {
    name: 'CSF4 dynamic story tags',
    code: dedent`
      import preview from '../../.storybook/preview'
      const meta = preview.meta({ component: Button })
      export const Primary = meta.story({ tags: computeTags() })
    `,
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'CSF4 dynamic title in a meta constant',
    code: dedent`
      import preview from '../../.storybook/preview'
      const config = { title: computeTitle() }
      const meta = preview.meta(config)
      export const Primary = meta.story({})
    `,
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.Property }],
  },
  {
    name: 'CSF4 dynamic tags assigned after a factory story',
    code: dedent`
      import preview from '../../.storybook/preview'
      const meta = preview.meta({ component: Button })
      export const Primary = meta.story({})
      Primary.tags = computeTags()
    `,
    indexable: false,
    errors: [{ messageId: 'dynamicProperty', type: AST_NODE_TYPES.AssignmentExpression }],
  },
];

ruleTester.run('static-csf-properties', rule, {
  valid: scenarios.filter((scenario) => !scenario.errors).map((scenario) => scenario.code),
  invalid: scenarios
    .filter((scenario) => scenario.errors)
    .map(({ code, errors }) => ({ code, errors: errors! })),
});

describe('static-csf-properties conformance with csf-tools', () => {
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

  scenarios.forEach(({ name, code, indexable }) => {
    it(`${name} (${indexable ? 'indexable' : 'not indexable'})`, () => {
      expect(csfToolsCanIndex(code)).toBe(indexable);
    });
  });
});
