import dependency from './commonjs-dependency.cjs';

globalThis.result = { dependency, module: typeof module };
