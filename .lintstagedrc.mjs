import { detectAgent } from 'std-env';

const autofix = process.env.FIX_ON_COMMIT || detectAgent().name;
const fmtCmd = autofix ? 'oxfmt' : 'oxfmt --check';
const lintSuffix = autofix ? ' --fix' : '';
const tocSuffix = autofix ? '' : ' --check';

export default {
  'code/**/*.{js,jsx,mjs,ts,tsx,html,json}': [fmtCmd],
  'code/**/*.{js,jsx,mjs,ts,tsx}': [`pnpm --dir code run lint:js:cmd${lintSuffix}`],
  'scripts/**/*.{js,jsx,mjs,ts,tsx}': [`pnpm --dir scripts run lint:js:cmd${lintSuffix}`],
  'docs/_snippets/**/*.{js,jsx,mjs,ts,tsx,html,json}': [fmtCmd],
  '**/*.ejs': ['pnpm --dir scripts exec ejslint'],
  '**/package.json': ['pnpm --dir scripts run lint:package'],
  './MIGRATION.md': [`pnpm --dir scripts run update-migration-toc${tocSuffix}`],
};
