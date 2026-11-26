import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import rule from './project-writes-through-effects.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { sourceType: 'module', parserOptions: { lang: 'ts' } },
});

const fsWrite = [{ messageId: 'fsWrite' }];
const command = [{ messageId: 'command' }];

ruleTester.run('project-writes-through-effects', rule, {
  valid: [
    "import { existsSync, readFileSync } from 'node:fs';",
    "import { readFile } from 'node:fs/promises';",
    "import fs from 'node:fs/promises'; await fs.readFile('a');",
    "import * as fs from 'node:fs'; fs.existsSync('a');",
    "import type { WriteStream } from 'node:fs';",
    "await effects.writeFile('a', 'b');",
    "await this.runInternalCommand('config', ['get', 'registry']);",
    "await executeCommand({ command: 'npm', args: ['view', 'storybook'] });",
    "await effects.runCommand('pnpm install', () => executeCommand({ command: 'pnpm', args: ['install'] }));",
    "await effects.runCommand('yarn config set', () => prompt.task(() => this.runInternalCommand('config', ['set', 'a', 'b'])));",
  ],
  invalid: [
    { code: "import { writeFile } from 'node:fs/promises';", errors: fsWrite },
    { code: "import { readFileSync, rmSync } from 'fs';", errors: fsWrite },
    { code: "import fs from 'node:fs/promises'; await fs.writeFile('a', 'b');", errors: fsWrite },
    { code: "import * as fs from 'node:fs'; fs.unlinkSync('a');", errors: fsWrite },
    { code: "import { promises } from 'node:fs'; await promises.rm('a');", errors: fsWrite },
    { code: "import fs from 'node:fs'; await fs.promises.cp('a', 'b');", errors: fsWrite },
    {
      code: "await this.runInternalCommand('config', ['set', 'minimumReleaseAgeExclude', '[]']);",
      errors: command,
    },
    { code: "await this.runInternalCommand('dedupe', []);", errors: command },
    {
      code: "await executeCommand({ command: 'pnpm', args: ['add', 'storybook'] });",
      errors: command,
    },
    {
      code: "executeCommandSync({ command: 'yarn', args: ['config', 'set', 'a', 'b'] });",
      errors: command,
    },
  ],
});
