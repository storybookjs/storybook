import {
  enhanceContext,
  nameSpiesAndWrapActionsInSpies,
  resetAllMocksLoader,
} from 'storybook/test';

export default {
  loaders: [resetAllMocksLoader, nameSpiesAndWrapActionsInSpies, enhanceContext],
};
