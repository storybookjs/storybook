import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import rule from './docgen-node-fields-through-contract.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { sourceType: 'module', parserOptions: { lang: 'ts' } },
});

const nativeOnly = [{ messageId: 'nativeOnly' }];

ruleTester.run('docgen-node-fields-through-contract', rule, {
  valid: [
    'const argument = ts.getTypeParameterDefault(parameter);',
    'const optional = ts.hasQuestionToken(member);',
    'const optional = !!parameter.questionToken;',
    'const reference = tag.name;',
    'const { name, type } = member;',
  ],
  invalid: [
    { code: 'const argument = parameter.defaultType;', errors: nativeOnly },
    {
      code: 'const argument = (parameter as { defaultType?: ts.TypeNode }).defaultType;',
      errors: nativeOnly,
    },
    { code: 'const optional = member.postfixToken?.kind;', errors: nativeOnly },
    { code: "const reference = tag['nameExpression'];", errors: nativeOnly },
    { code: "const native = 'postfixToken' in member;", errors: nativeOnly },
    { code: 'const { nameExpression } = tag;', errors: nativeOnly },
  ],
});
