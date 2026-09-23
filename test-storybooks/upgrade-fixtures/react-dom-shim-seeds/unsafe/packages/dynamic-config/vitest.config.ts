import { defineConfig } from 'vitest/config';

const shimPackage = ['@storybook', 'react-dom-shim'].join('/');
const legacyEntry = process.env.STORYBOOK_REACT_DOM_ENTRY ?? `${shimPackage}/dist/react-16`;

export default defineConfig({
  resolve: {
    alias: {
      [shimPackage]: legacyEntry,
    },
  },
});
