import { detectAgent } from 'std-env';

const autofix = process.env.FIX_ON_COMMIT || detectAgent().name;
const fmtCmd = autofix ? 'oxfmt' : 'oxfmt --check';
const lintSuffix = autofix ? ' --fix' : '';

export default {
  // oxfmt skips unknown extensions and respects .oxfmtrc.json ignorePatterns,
  // so matching every staged file keeps pre-commit aligned with CI (yarn fmt:check)
  '*': [fmtCmd],
  'code/**/*.{js,jsx,mjs,ts,tsx,html,json}': [`yarn --cwd code lint:js:cmd${lintSuffix}`],
  'scripts/**/*.{html,js,json,jsx,mjs,ts,tsx}': [`yarn --cwd scripts lint:js:cmd${lintSuffix}`],
  '**/*.ejs': ['yarn --cwd scripts exec ejslint'],
  '**/package.json': ['yarn --cwd scripts lint:package'],
};
