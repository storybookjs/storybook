import storybook, { configs, rules } from '../../dist/index.js';

export const consumer = {
  plugin: storybook,
  recommended: configs['flat/recommended'],
  messages: rules['default-exports'].meta.messages,
  defaultOptions: rules['no-uninstalled-addons'].defaultOptions,
};
