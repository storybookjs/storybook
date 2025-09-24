import cp from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { PromptObject } from 'prompts';
import prompts from 'prompts';
import { dedent } from 'ts-dedent';

const logger = console;

type Answers = {
  authorName: string;
  ruleId: string;
  ruleDescription: string;
  isAutoFixable: boolean;
};

// CLI questions
const questions: PromptObject<keyof Answers>[] = [
  {
    type: 'text',
    name: 'authorName',
    initial: '',
    message: 'What is your name? (to be given credit for the rule)',
    validate: (name: string) => (name === '' ? "Name can't be empty" : true),
  },
  {
    type: 'text',
    name: 'ruleId',
    message: dedent(`Time to name your rule! Follow the ESLint rule naming conventions:

      - If your rule is disallowing something, prefix it with no- such as no-eval for disallowing eval() and no-debugger for disallowing debugger.
      - If your rule is enforcing the inclusion of something, use a short name without a special prefix.
      - Use dashes between words.
      What is the ID of this new rule?
    `),
    validate: (rule: string) => (rule === '' ? "Rule can't be empty" : true),
  },
  {
    type: 'text',
    name: 'ruleDescription',
    message: 'Type a short description of this rule',
    validate: (rule: string) => (rule === '' ? "Description can't be empty" : true),
  },
  {
    type: 'confirm',
    name: 'isAutoFixable',
    message: 'Will this rule contain an autofix?',
    initial: true,
  },
];

const generateRule = async () => {
  logger.log(
    '👋 Welcome to the Storybook ESLint rule generator! Please answer a few questions so I can provide everything you need for your new rule.'
  );
  logger.log('');
  const { authorName, ruleId, ruleDescription, isAutoFixable } = await prompts(questions, {
    onCancel: () => {
      logger.log('Process canceled by the user.');
      process.exit(0);
    },
  });

  const ruleFile = path.resolve(__dirname, `../src/rules/${ruleId}.ts`);
  const testFile = path.resolve(__dirname, `../tests/rules/${ruleId}.test.ts`);
  const docFile = path.resolve(__dirname, `../docs/rules/${ruleId}.md`);

  logger.log(`creating src/rules/${ruleId}.ts`);
  await fs.writeFile(
    ruleFile,
    dedent(`/**
       * @fileoverview ${ruleDescription}
       * @author ${authorName}
       */

      import { TSESTree } from '@typescript-eslint/utils'
      import { createStorybookRule } from '../utils/create-storybook-rule'
      import { CategoryId } from '../utils/constants'
      import { isIdentifier, isVariableDeclaration } from '../utils/ast'

      //------------------------------------------------------------------------------
      // Rule Definition
      //------------------------------------------------------------------------------

      export default createStorybookRule({
        name: '${ruleId}',
        defaultOptions: [],
        meta: {
          type: 'problem', // \`problem\`, \`suggestion\`, or \`layout\`
          severity: 'error', // or 'warn'
          docs: {
            description: '${ruleDescription}',
            // Add the categories that suit this rule.
            categories: [CategoryId.RECOMMENDED],
          },
          messages: {
            anyMessageIdHere: 'Fill me in',
          },
          ${isAutoFixable ? "fixable: 'code'," : ''}
          ${isAutoFixable ? 'hasSuggestions: true,' : ''}
          schema: [], // Add a schema if the rule has options. Otherwise remove this
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
            /**
             * 👉 Please read this and then delete this entire comment block.
             * This is an example rule that reports an error in case a named export is called 'wrong'.
             * Hopefully this will guide you to write your own rules. Make sure to always use the AST utilities and account for all possible cases.
             *
             * Keep in mind that sometimes AST nodes change when in javascript or typescript format. For example, the type of "declaration" from "export default {}" is ObjectExpression but in "export default {} as SomeType" is TSAsExpression.
             *
             * Use https://eslint.org/docs/developer-guide/working-with-rules for Eslint API reference
             * And check https://astexplorer.net/ to help write rules
             * Working with AST is fun. Good luck!
             */
            ExportNamedDeclaration: function (node: TSESTree.ExportNamedDeclaration) {
              const declaration = node.declaration
              if (!declaration) return
              // use AST helpers to make sure the nodes are of the right type
              if (isVariableDeclaration(declaration)) {
                const identifier = declaration.declarations[0]?.id
                if (isIdentifier(identifier)) {
                  const { name } = identifier
                  if (name === 'wrong') {
                    context.report({
                      node,
                      messageId: 'anyMessageIdHere',
                    })
                  }
                }
              }
            },
          }
        },
      })

`)
  );

  logger.log(`creating tests/rules/${ruleId}.test.ts`);
  await fs.writeFile(
    testFile,
    dedent(`/**
         * @fileoverview ${ruleDescription}
         * @author ${authorName}
         */

        //------------------------------------------------------------------------------
        // Requirements
        //------------------------------------------------------------------------------

        import rule from '../../src/rules/${ruleId}'
        import ruleTester from '../utils/rule-tester'

        //------------------------------------------------------------------------------
        // Tests
        //------------------------------------------------------------------------------

        ruleTester.run('${ruleId}', rule, {
          /**
           * 👉 Please read this and delete this entire comment block.
           * This is an example test for a rule that reports an error in case a named export is called 'wrong'
           * Use https://eslint.org/docs/developer-guide/working-with-rules for Eslint API reference
           */
          valid: ['export const correct = {}'],
          invalid: [
            {
              code: 'export const wrong = {}',
              errors: [
                {
                  messageId: 'anyMessageIdHere', // comes from the rule file
                },
              ],
            },
          ],
        })

`)
  );

  logger.log(`creating docs/rules/${ruleId}.md`);
  await fs.writeFile(
    docFile,
    dedent(`
      # ${ruleId}

      <!-- RULE-CATEGORIES:START -->
      <!-- RULE-CATEGORIES:END -->

      ## Rule Details

      ${ruleDescription}.

      Examples of **incorrect** code for this rule:

      \`\`\`js
      // fill me in
      \`\`\`

      Examples of **correct** code for this rule:

      \`\`\`js
      // fill me in
      \`\`\`

      ### Options

      If there are any options, describe them here. Otherwise, delete this section.

      ## When Not To Use It

      Give a short description of when it would be appropriate to turn off this rule. If not applicable, delete this section.

      ## Further Reading

      If there are other links that describe the issue this rule addresses, please include them here in a bulleted list. Otherwise, delete this section.

`)
  );

  const { shouldOpenInVSCode } = await prompts({
    type: 'confirm',
    name: 'shouldOpenInVSCode',
    message: 'Do you want to open the newly generated files in VS Code?',
    initial: false,
  });

  if (shouldOpenInVSCode) {
    cp.execSync(`code "${ruleFile}"`);
    cp.execSync(`code "${testFile}"`);
    cp.execSync(`code "${docFile}"`);
  }

  logger.log(
    '\n🚀 All done! Make sure to run `yarn test` as you write the rule and `yarn update-rules` when you are done. This script will update the necessary config and docs files to reflect your changes.'
  );
  logger.log(`❤️  Thanks for helping this plugin get better, ${authorName.split(' ')[0]}!`);
};

generateRule().catch((error) => {
  logger.error('An error occurred while generating the rule:', error);
  process.exit(1);
});
