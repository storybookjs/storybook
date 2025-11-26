const { sync: spawnSync } = require('cross-spawn');
const path = require('path');

const CORE_CLI_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'core',
  'dist',
  'bin',
  'dispatcher.js'
);

/**
 * Execute command
 *
 * @param {String[]} args - Args to be passed in
 * @param {Object} options - Customize the behavior
 * @returns {Object}
 */
const run = (args, options = {}) => spawnSync('node', [CORE_CLI_PATH].concat(args), options);

const cleanLog = (str) => {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
  ].join('|');

  return str.replace(new RegExp(pattern, 'g'), '');
};

module.exports = {
  run,
  cleanLog,
};
