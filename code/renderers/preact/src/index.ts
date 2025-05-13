/// <reference types="webpack-env" />
import './globals';

export * from './public-types';
export * from './portable-stories';

// optimization: stop HMR propagation in webpack

// optimization: stop HMR propagation in webpack
if (typeof module !== 'undefined') {
  module?.hot?.decline();
}
