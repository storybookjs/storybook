import { detectAgent } from 'std-env';

const autofix = process.env.FIX_ON_COMMIT || detectAgent().name;
const fmtCmd = autofix ? 'oxfmt' : 'oxfmt --check';
const lintSuffix = autofix ? ' --fix' : '';
const tocSuffix = autofix ? '' : ' --check';

export default {
  'code/**/*.{js,jsx,mjs,ts,tsx,html,json}': [fmtCmd],
  'code/**/*.{js,jsx,mjs,ts,tsx}': [`yarn --cwd code lint:js:cmd${lintSuffix}`],
  'scripts/**/*.{js,jsx,mjs,ts,tsx}': [`yarn --cwd scripts lint:js:cmd${lintSuffix}`],
  'docs/_snippets/**/*.{js,jsx,mjs,ts,tsx,html,json}': [fmtCmd],
  '**/*.ejs': ['yarn --cwd scripts exec ejslint'],
  '**/package.json': ['yarn --cwd scripts lint:package'],
  './MIGRATION.md': [`yarn --cwd scripts update-migration-toc${tocSuffix}`],
};
