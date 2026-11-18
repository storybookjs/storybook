/**
 * @file storiesOf was removed in Storybook 8.0; use CSF instead
 * @author Yann Braga
 */
import { CategoryId } from '../utils/constants.ts';
import { createStorybookRule } from '../utils/create-storybook-rule.ts';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export default createStorybookRule({
  name: 'no-stories-of',
  defaultOptions: [],
  meta: {
    type: 'problem',
    severity: 'error',
    docs: {
      description: 'storiesOf was removed in Storybook 8.0; use CSF instead.',
      categories: [CategoryId.CSF_STRICT],
    },
    messages: {
      doNotUseStoriesOf: 'storiesOf was removed in Storybook 8.0; use CSF instead.',
    },
    schema: [],
  },

  create(context) {
    // variables should be defined here

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    // any helper functions should go here or else delete this section

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    return {
      ImportSpecifier(node) {
        if ('name' in node.imported && node.imported.name === 'storiesOf') {
          context.report({
            node,
            messageId: 'doNotUseStoriesOf',
          });
        }
      },
    };
  },
});
