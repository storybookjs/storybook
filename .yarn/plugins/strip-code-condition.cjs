// The `code` export condition points at `src/`, which only exists in the repo; drop it from packed
// manifests so `yarn pack` and `yarn npm publish` ship a smaller exports map.
module.exports = {
  name: 'plugin-strip-code-condition',
  factory: () => ({
    hooks: {
      beforeWorkspacePacking(_workspace, rawManifest) {
        if (rawManifest.exports) {
          rawManifest.exports = stripCodeCondition(rawManifest.exports);
        }
      },
    },
  }),
};

function stripCodeCondition(value) {
  if (Array.isArray(value)) {
    return value.map(stripCodeCondition);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'code')
      .map(([key, target]) => [key, stripCodeCondition(target)])
  );
}
