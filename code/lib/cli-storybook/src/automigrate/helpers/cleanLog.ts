import { EOL } from 'node:os';

// copied from https://github.com/chalk/ansi-regex
// the package is ESM only so not compatible with jest
export const ansiRegex = ({ onlyFirst = false } = {}) => {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
  ].join('|');

  return new RegExp(pattern, onlyFirst ? undefined : 'g');
};

export const cleanLog = (str: string) =>
  str
    // remove chalk ANSI colors
    .replace(ansiRegex(), '')
    // fix boxen output
    .replace(/╮│/g, '╮\n│')
    .replace(/││/g, '│\n│')
    .replace(/│╰/g, '│\n╰')
    .replace(/⚠️ {2}failed to check/g, `${EOL}⚠️  failed to check`);
