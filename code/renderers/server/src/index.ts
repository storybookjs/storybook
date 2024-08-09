/// <reference types="webpack-env" />
import './globals';

export * from './public-types';

// optimization: stop HMR propagation in webpack
if (typeof module !== 'undefined') module?.hot?.decline();
