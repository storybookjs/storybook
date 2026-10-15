import { dedent } from 'ts-dedent';

import ruleTester from '../test-utils.ts';
import rule from './static-csf-properties.ts';

ruleTester.run('static-csf-properties', rule, {
  valid: [
    "export default { title: 'Button', component: Button }",
    "export default { id: 'button-id', tags: ['autodocs', '!dev'] }",
    "export default { includeStories: ['Primary'], excludeStories: /.*Data$/ }",
    "export default { includeStories: 'Primary' }",
    dedent`
      const TITLE = 'Atoms/Button'
      export default { title: TITLE }
    `,
    dedent`
      const TITLE = 'Atoms/Button' satisfies string
      export default { title: TITLE }
    `,
    dedent`
      const tags = ['autodocs']
      export default { tags }
    `,
    "export default { title: 'Button' satisfies string }",
    // statically read properties placed after a spread match the runtime result
    "export default { ...baseMeta, title: 'Button', tags: ['autodocs'] }",
    // spread position only matters for the properties the indexer reads
    "export default { args: { primary: true }, ...baseArgs, title: 'Button' }",
    dedent`
      export default { component: Button }
      export const Primary = { tags: ['snapshot'] }
    `,
    dedent`
      const tags = ['snapshot']
      export default { component: Button }
      export const Primary = { tags }
    `,
    // non-story exports are not indexed, so their shape is unconstrained
    dedent`
      export default { component: Button, excludeStories: ['mockData'] }
      export const mockData = { tags: generateTags() }
    `,
    // CSF4 factories
    dedent`
      import preview from '../../.storybook/preview'
      const meta = preview.meta({ title: 'Button', tags: ['autodocs'] })
      export const Primary = meta.story({ tags: ['snapshot'] })
    `,
    dedent`
      import preview from '../../.storybook/preview'
      const config = { title: 'Button' }
      const meta = preview.meta(config)
    `,
    dedent`
      import preview from '../../.storybook/preview'
      const meta = preview.type().meta({ title: 'Button' })
    `,
    // member .meta() calls unrelated to Storybook are ignored
    dedent`
      import { z } from 'zod'
      export default { component: Button }
      const schema = z.string().meta({ title: computeTitle() })
    `,
  ],

  invalid: [
    {
      code: 'export default { title: getTitle() }',
      errors: [{ messageId: 'dynamicProperty' }],
    },
    {
      code: 'export default { title: `Button/${suffix}` }',
      errors: [{ messageId: 'dynamicProperty' }],
    },
    {
      code: dedent`
        import { TITLE } from './titles'
        export default { title: TITLE }
      `,
      errors: [{ messageId: 'dynamicProperty' }],
    },
    {
      // the indexer resolves local constants for title and tags, but not for id
      code: dedent`
        const ID = 'button-id'
        export default { id: ID }
      `,
      errors: [{ messageId: 'dynamicProperty' }],
    },
    {
      code: "export default { tags: [...baseTags, 'autodocs'] }",
      errors: [{ messageId: 'dynamicProperty' }],
    },
    {
      code: dedent`
        const EXTRA = 'autodocs'
        export default { tags: ['dev', EXTRA] }
      `,
      errors: [{ messageId: 'dynamicProperty' }],
    },
    {
      // include/exclude do not support identifier indirection at all
      code: dedent`
        const included = ['Primary']
        export default { includeStories: included }
      `,
      errors: [{ messageId: 'dynamicProperty' }],
    },
    {
      code: "export default { title: 'Button', ...baseMeta }",
      errors: [
        {
          messageId: 'propertyBeforeSpread',
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
      code: "export default { 'title': 'Button' }",
      errors: [
        {
          messageId: 'ignoredKey',
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
      code: "export default { ['title']: 'Button' }",
      errors: [{ messageId: 'ignoredKey' }],
    },
    {
      code: dedent`
        const title = 'parameters'
        export default { [title]: { layout: 'fullscreen' } }
      `,
      errors: [{ messageId: 'misreadComputedKey' }],
    },
    {
      code: dedent`
        export default { component: Button }
        export const Primary = { tags: generateTags() }
      `,
      errors: [{ messageId: 'dynamicProperty' }],
    },
    {
      code: dedent`
        export default { component: Button }
        export const Primary = { tags: ['snapshot'], ...sharedStory }
      `,
      errors: [
        {
          messageId: 'propertyBeforeSpread',
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
      code: dedent`
        const story = { tags: makeTags() }
        export default { component: Button }
        export { story as Primary }
      `,
      errors: [{ messageId: 'dynamicProperty' }],
    },
    {
      code: dedent`
        const meta = { title: getTitle() }
        export { meta as default }
      `,
      errors: [{ messageId: 'dynamicProperty' }],
    },
    // CSF4 factories
    {
      code: dedent`
        import preview from '../../.storybook/preview'
        const meta = preview.meta({ title: getTitle() })
      `,
      errors: [{ messageId: 'dynamicProperty' }],
    },
    {
      code: dedent`
        import preview from '../../.storybook/preview'
        const meta = preview.meta(generateMeta())
      `,
      errors: [{ messageId: 'unresolvableFactoryMeta' }],
    },
    {
      code: dedent`
        import preview from '../../.storybook/preview'
        let config = { title: 'Button' }
        config = extend(config)
        const meta = preview.meta(config)
      `,
      errors: [{ messageId: 'unresolvableFactoryMeta' }],
    },
    {
      code: dedent`
        import preview from './local-preview-config'
        const meta = preview.meta({ title: 'Button' })
      `,
      errors: [{ messageId: 'invalidPreviewImport' }],
    },
    {
      code: dedent`
        import preview from '../../.storybook/preview'
        const meta = preview.meta({ component: Button })
        export const Primary = meta.story({ tags: computeTags() })
      `,
      errors: [{ messageId: 'dynamicProperty' }],
    },
    {
      code: dedent`
        import preview from '../../.storybook/preview'
        const config = { title: computeTitle() }
        const meta = preview.meta(config)
      `,
      errors: [{ messageId: 'dynamicProperty' }],
    },
  ],
});
