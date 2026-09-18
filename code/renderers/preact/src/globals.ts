import { global } from '@storybook/global';

const { window: globalWindow } = global;

if (globalWindow) {
  globalWindow.STORYBOOK_ENV = 'preact';
}
