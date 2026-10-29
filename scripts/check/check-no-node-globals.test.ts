import { describe, expect, it } from 'vitest';

import { findNodeGlobals } from './check-no-node-globals.ts';

describe('findNodeGlobals', () => {
  it.each([
    {
      name: 'module-level let',
      input: { file: 'core/src/services/a.ts', code: 'import x from "x";\nlet cache;\n' },
      expected: ['core/src/services/a.ts:2 cache'],
    },
    {
      name: 'exported var',
      input: { file: 'addons/vitest/src/node/a.ts', code: 'export var child = null;' },
      expected: ['addons/vitest/src/node/a.ts:1 child'],
    },
    {
      name: 'fallback constant',
      input: {
        file: 'core/src/instance/a.ts',
        code: 'const FALLBACK_REGISTRY = new Map();\nreturn FALLBACK_REGISTRY;',
      },
      expected: [
        'core/src/instance/a.ts:1 FALLBACK_REGISTRY',
        'core/src/instance/a.ts:2 FALLBACK_REGISTRY',
      ],
    },
    {
      name: 'let inside a function',
      input: {
        file: 'core/src/services/a.ts',
        code: 'export function f() {\n  let local = 0;\n  return local;\n}',
      },
      expected: [],
    },
    {
      name: 'guarded single file',
      input: { file: 'addons/mcp/src/mcp-handler.ts', code: 'let transport;' },
      expected: ['addons/mcp/src/mcp-handler.ts:1 transport'],
    },
    {
      name: 'toolset registry',
      input: {
        file: 'core/src/shared/open-service/toolset-registry.ts',
        code: 'let registry = new Map();',
      },
      expected: ['core/src/shared/open-service/toolset-registry.ts:1 registry'],
    },
    {
      name: 'universal store realm',
      input: { file: 'core/src/shared/universal-store/realm.ts', code: 'let realm;' },
      expected: ['core/src/shared/universal-store/realm.ts:1 realm'],
    },
    {
      name: 'core store adapters',
      input: { file: 'core/src/services/stores/status.ts', code: 'var CACHES = new WeakMap();' },
      expected: ['core/src/services/stores/status.ts:1 CACHES'],
    },
    {
      name: 'open-service SDK',
      input: { file: 'lib/open-service/src/create-tools.ts', code: 'let host;' },
      expected: ['lib/open-service/src/create-tools.ts:1 host'],
    },
    {
      name: 'unguarded open-service runtime',
      input: { file: 'core/src/shared/open-service/query-runtime.ts', code: 'let session;' },
      expected: [],
    },
    {
      name: 'unguarded file',
      input: { file: 'addons/mcp/src/utils/module-graph.ts', code: 'let probed;' },
      expected: [],
    },
  ])('$name', ({ input, expected }) => {
    expect(findNodeGlobals([input])).toEqual(expected);
  });
});
