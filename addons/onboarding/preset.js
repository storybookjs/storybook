function managerEntries(entry = []) {
  return [...entry, require.resolve('./dist/manager.js')];
}

module.exports = {
  managerEntries,
  ...require('./dist/preset'),
};
