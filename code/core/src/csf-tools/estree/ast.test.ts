import { describe, expect, it } from 'vitest';

import { parseModule } from './ast.ts';

describe('parseModule', () => {
  const flowBody = 'const x: { +readOnly: number } = {};';

  it.each([
    ['// @flow', `// @flow\n${flowBody}`],
    ['/* @flow */', `/* @flow */\n${flowBody}`],
    ['/** @flow */', `/** @flow */\n${flowBody}`],
    ['/* @flow strict */', `/* @flow strict */\n${flowBody}`],
    ['a multi-line docblock', `/**\n * Button stories.\n *\n * @flow\n */\n${flowBody}`],
    [
      '// @flow after a license comment',
      `/*\n * Copyright (c) Example Inc.\n * MIT license.\n */\n\n// @flow\n${flowBody}`,
    ],
  ])('names Flow when a file with %s fails to parse', (_, code) => {
    expect(() => parseModule(code)).toThrow('Flow syntax is no longer supported');
  });

  it('reports the parse error when @flow only appears after the first statement', () => {
    expect(() => parseModule(`import x from 'x';\n// @flow\n${flowBody}`)).toThrow(
      /^Unexpected token/
    );
  });

  it('names the file in the Flow error', () => {
    expect(() => parseModule(`// @flow\n${flowBody}`, 'Button.stories.js')).toThrow(
      'in Button.stories.js'
    );
  });
});
