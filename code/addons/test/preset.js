const { checkActionsLoaded } = require('./dist/preset');

function previewAnnotations(entry = [], options) {
  checkActionsLoaded(options.configDir);
  return entry;
}

module.exports = {
  previewAnnotations,
};
