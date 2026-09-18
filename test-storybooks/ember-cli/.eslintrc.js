module.exports = {
  rules: {
    'import/extensions': 0,
  },
  settings: {
    'import/core-modules': [
      '@ember/component',
      '@ember/routing/router',
      '@ember/application',
      './config/environment',
    ],
  },
};
