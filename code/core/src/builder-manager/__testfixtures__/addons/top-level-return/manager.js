const { addons } = require('storybook/manager-api');

addons.register('before-return', () => {});

if (typeof window !== 'undefined') return;

addons.register('after-return', () => {});
