import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import rule from './no-module-scope-platform-check.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { sourceType: 'module', parserOptions: { lang: 'ts' } },
});

const moduleScope = [{ messageId: 'moduleScope' }];

ruleTester.run('no-module-scope-platform-check', rule, {
  valid: [
    "const isWindows = () => process.platform === 'win32';",
    "function isWindows() { return process.platform === 'win32'; }",
    "export const isRawTransferAvailable = () => process.platform !== 'win32' && supported();",
    "class Runner { isWindows = process.platform === 'win32'; }",
    "import os from 'node:os'; const shell = { get windows() { return os.platform() === 'win32'; } };",
    "import { EOL } from 'node:os'; export const join = (lines) => lines.join(EOL);",
    "import path from 'node:path'; const split = (p) => p.split(path.sep);",
    "import { sep } from 'pathe'; const parts = 'a/b'.split(sep);",
    "import os from 'node:os'; const platform = os.platform;",
    'const platform = options.platform;',
    "const os = { EOL: '\\n' }; const eol = os.EOL;",
  ],
  invalid: [
    { code: "const isWindows = process.platform === 'win32';", errors: moduleScope },
    {
      code: "export const rawTransferAvailable = process.platform !== 'win32' && supported();",
      errors: moduleScope,
    },
    { code: "if (process.platform === 'win32') { setup(); }", errors: moduleScope },
    {
      code: "class Runner { static isWindows = process.platform === 'win32'; }",
      errors: moduleScope,
    },
    { code: 'class Runner { static { setup(process.platform); } }', errors: moduleScope },
    { code: 'const { platform } = process;', errors: moduleScope },
    {
      code: "import os from 'node:os'; const isWindows = os.platform() === 'win32';",
      errors: moduleScope,
    },
    {
      code: "import * as system from 'os'; const isWindowsNt = system.type() === 'Windows_NT';",
      errors: moduleScope,
    },
    {
      code: "import { platform } from 'node:os'; const isWindows = platform() === 'win32';",
      errors: moduleScope,
    },
    { code: "import { EOL } from 'node:os'; const footer = `end${EOL}`;", errors: moduleScope },
    { code: "import path from 'node:path'; const SEP = path.sep;", errors: moduleScope },
    {
      code: "import { delimiter as d } from 'path'; const PATHS = env.split(d);",
      errors: moduleScope,
    },
  ],
});
