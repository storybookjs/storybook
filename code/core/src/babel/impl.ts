/**
 * The transform side of babel, kept in its own entry so its ~1.4 MB is a separate dist file: the
 * wrappers in `./index.ts` `require()` it on first call, and a process that never parses does not
 * read or compile it. Do not import this module statically from anywhere on a startup path.
 */
import * as core from '@babel/core';
import generatorModule from '@babel/generator';
import traverseModule from '@babel/traverse';
import * as recast from 'recast';

// `@babel/traverse` and `@babel/generator` are CJS packages that put their function on
// `exports.default`.
const traverse = ((traverseModule as any).default || traverseModule) as typeof traverseModule;
const generate = ((generatorModule as any).default || generatorModule) as typeof generatorModule;

export { core, generate, recast, traverse };
