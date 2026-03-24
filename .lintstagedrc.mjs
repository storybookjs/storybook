import { detectAgent } from 'std-env';

const fmtCmd = detectAgent().name ? 'oxfmt' : 'oxfmt --check';

export default {
  'code/**/*.{js,jsx,mjs,ts,tsx,html,json}': [fmtCmd, 'yarn --cwd code lint:js:cmd'],
  'scripts/**/*.{html,js,json,jsx,mjs,ts,tsx}': ['yarn --cwd scripts lint:js:cmd'],
  'docs/_snippets/**/*.{js,jsx,mjs,ts,tsx,html,json}': [fmtCmd],
  '**/*.ejs': ['yarn --cwd scripts exec ejslint'],
  '**/package.json': ['yarn --cwd scripts lint:package'],
};
