const { sync: spawnSync } = require('cross-spawn');
const path = require('path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'index.cjs');

/**
 * Execute command
 * @param {String[]} args - args to be passed in
 * @param {Object} options - customize the behavior
 *
 * @returns {Object}
 */
const run = (args, options = {}) => spawnSync('node', [CLI_PATH].concat(args), options);

module.exports = run;
