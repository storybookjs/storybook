import { detectAgent } from 'std-env';

const autofix = process.env.FIX_ON_COMMIT || detectAgent().name;
const fmtCmd = autofix ? 'oxfmt' : 'oxfmt --check';
const lintSuffix = autofix ? ' --fix' : '';

export default {
  // Repo root: included in yarn fmt:check but not under code/scripts/docs_snippets globs below
  '{.lintstagedrc.mjs,.oxfmtrc.json,nx.json,vitest.config.ts}': [fmtCmd],
  'code/**/*.{js,jsx,mjs,ts,tsx,html,json}': [fmtCmd, `yarn --cwd code lint:js:cmd${lintSuffix}`],
  'scripts/**/*.{html,js,json,jsx,mjs,ts,tsx}': [
    fmtCmd,
    `yarn --cwd scripts lint:js:cmd${lintSuffix}`,
  ],
  'docs/_snippets/**/*.{js,jsx,mjs,ts,tsx,html,json}': [fmtCmd],
  '**/*.ejs': ['yarn --cwd scripts exec ejslint'],
  '**/package.json': ['yarn --cwd scripts lint:package'],
};
