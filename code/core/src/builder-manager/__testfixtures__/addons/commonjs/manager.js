const React = require('react');
const { addons } = require('storybook/manager-api');

addons.register('commonjs', () =>
  addons.add('commonjs/tool', { element: React.createElement('i') })
);

module.exports = {};
