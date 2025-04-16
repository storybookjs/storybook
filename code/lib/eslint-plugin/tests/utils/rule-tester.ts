import { RuleTester } from '@typescript-eslint/rule-tester';
import type { TSESLint } from '@typescript-eslint/utils';

const DEFAULT_TEST_CASE_CONFIG = {
  filename: 'MyComponent.stories.js',
};

class StorybookRuleTester extends RuleTester {
  run<TMessageIds extends string, TOptions extends Readonly<unknown[]>>(
    ruleName: string,
    rule: TSESLint.RuleModule<TMessageIds, TOptions>,
    tests: TSESLint.RunTests<TMessageIds, TOptions>
  ): void {
    const { valid, invalid } = tests;

    const finalValid = valid.map((testCase) => {
      if (typeof testCase === 'string') {
        return {
          ...DEFAULT_TEST_CASE_CONFIG,
          code: testCase,
        };
      }

      return { ...DEFAULT_TEST_CASE_CONFIG, ...testCase };
    });
    const finalInvalid = invalid.map((testCase) => ({
      ...DEFAULT_TEST_CASE_CONFIG,
      ...testCase,
    }));

    super.run(ruleName, rule, { valid: finalValid, invalid: finalInvalid });
  }
}

export const createRuleTester = (): RuleTester => {
  return new StorybookRuleTester();
};

export default createRuleTester();
