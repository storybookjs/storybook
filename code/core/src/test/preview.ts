import { enhanceContext, nameSpiesAndWrapActionsInSpies, resetAllMocksLoader } from './index';

export default {
  loaders: [resetAllMocksLoader, nameSpiesAndWrapActionsInSpies, enhanceContext],
};
