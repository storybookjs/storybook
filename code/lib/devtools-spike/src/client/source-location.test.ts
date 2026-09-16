import { describe, expect, it } from 'vitest';

import {
  decodeVlqSegment,
  decodeMappings,
  firstAppFrame,
  findNearestDebugOrigin,
  findOwnRenderFrame,
  parseStackFrames,
  readLegacySource,
  relativizeWorkspacePath,
  resolveSource,
  type FiberLike,
} from './source-location.ts';

/** Independent VLQ encoder — fixtures are built, not copied from the impl. */
function encodeVlq(value: number): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let remaining = value < 0 ? (-value << 1) | 1 : value << 1;
  let out = '';
  do {
    let digit = remaining & 31;
    remaining >>>= 5;
    if (remaining > 0) {
      digit |= 32;
    }
    out += ALPHABET[digit];
  } while (remaining > 0);
  return out;
}

function encodeSegment(values: number[]): string {
  return values.map((v) => encodeVlq(v)).join('');
}

const WORKSPACE_FILE =
  '/home/user/work/storybook/code/lib/devtools-spike/demo/react-19/src/App.tsx';

describe('vlq decoding', () => {
  it('round-trips single segments including negatives', () => {
    for (const value of [0, 1, -1, 8, -8, 15, 16, -16, 1023, -1023]) {
      expect(decodeVlqSegment(encodeVlq(value))).toEqual([value]);
    }
  });

  it('decodes delta-encoded multi-line mappings', () => {
    const mappings = ['AAAA', encodeSegment([0, 0, 1, 0]), encodeSegment([8, 0, 18, 1])].join(';');
    const lines = decodeMappings(mappings);
    expect(lines).toHaveLength(3);
    expect(lines[2][0]).toEqual({
      generatedColumn: 8,
      sourceIndex: 0,
      sourceLine: 19, // 0-based
      sourceColumn: 1, // 0-based
    });
  });
});

describe('stack frame parsing', () => {
  it('parses both `at fn (url:line:col)` and bare url frames', () => {
    const stack = [
      'Error: react-stack-top-frame',
      '    at UnknownOwner (http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js:1:1)',
      '    at Card (http://localhost:5173/src/App.tsx:33:9)',
      '    at http://localhost:5173/src/main.tsx:10:3',
    ].join('\n');
    expect(parseStackFrames(stack)).toEqual([
      {
        url: 'http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js',
        line: 1,
        column: 1,
        functionName: 'UnknownOwner',
      },
      { url: 'http://localhost:5173/src/App.tsx', line: 33, column: 9, functionName: 'Card' },
      { url: 'http://localhost:5173/src/main.tsx', line: 10, column: 3 },
    ]);
  });

  it('skips react/bundler internals and returns the first app frame', () => {
    const stack = [
      'Error: react-stack-top-frame',
      '    at UnknownOwner (http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js:1:1)',
      '    at renderWithHooks (http://localhost:5173/node_modules/.vite/deps/react-dom-client.js:1234:5)',
      '    at Card (http://localhost:5173/src/App.tsx:33:9)',
    ].join('\n');
    expect(firstAppFrame(stack)).toEqual({
      url: 'http://localhost:5173/src/App.tsx',
      line: 33,
      column: 9,
      functionName: 'Card',
    });
  });

  it('returns null when every frame is internal', () => {
    const stack =
      '    at renderWithHooks (http://localhost:5173/node_modules/.vite/deps/react.js:1:1)';
    expect(firstAppFrame(stack)).toBeNull();
  });
});

describe('regime 1 — React < 19.2 (_debugSource / __source)', () => {
  const legacy = {
    fileName: WORKSPACE_FILE,
    lineNumber: 20,
    columnNumber: 9,
  };

  it('prefers element._source', async () => {
    const element = { _source: legacy };
    const fiber: FiberLike = { type: 'button' };
    const result = await resolveSource(fiber, element, () => Promise.resolve(null));
    expect(result).toEqual({
      file: 'code/lib/devtools-spike/demo/react-19/src/App.tsx',
      line: 20,
      column: 9,
      regime: 'debugSource',
    });
  });

  it('falls back to fiber._debugSource', async () => {
    const fiber: FiberLike = { type: 'button', _debugSource: legacy };
    const result = await resolveSource(fiber, {}, () => Promise.resolve(null));
    expect(result?.regime).toBe('debugSource');
    expect(result?.line).toBe(20);
  });

  it('ignores malformed legacy fields', async () => {
    const fiber: FiberLike = { type: 'button', _debugSource: { fileName: 42 } };
    expect(await resolveSource(fiber, {}, () => Promise.resolve(null))).toBeNull();
  });
});

describe('regime 2 — React >= 19.2 (component stacks)', () => {
  it('uses the Babel source object found on _debugStack directly', async () => {
    // What react@19.2.8 + @vitejs/plugin-react actually produce: the 5th
    // jsxDEV argument lands on element._debugStack as a source object.
    const fiber: FiberLike = {
      type: 'button',
      _debugStack: { fileName: WORKSPACE_FILE, lineNumber: 8, columnNumber: 10 },
    };
    const result = await resolveSource(fiber, {}, () => Promise.resolve(null));
    expect(result).toEqual({
      file: 'code/lib/devtools-spike/demo/react-19/src/App.tsx',
      line: 8,
      column: 10,
      regime: 'componentStack',
    });
  });

  it('symbolicates a captured Error through the inline source map', async () => {
    // Owner chain: hovered host fiber (no debug data) → component fiber with
    // an Error captured at the JSX site; its app frame points into the
    // transformed module, whose inline map symbolicates to the original .tsx.
    const mapJson = JSON.stringify({
      version: 3,
      sources: ['App.tsx'],
      file: WORKSPACE_FILE,
      mappings: ['AAAA', encodeSegment([0, 0, 1, 0]), encodeSegment([8, 0, 18, 1])].join(';'),
    });
    const transformedModule = [
      'const x = 1;',
      'const y = 2;',
      'jsxDEV(Card, {}, void 0, false);',
      `//# sourceMappingURL=data:application/json;base64,${Buffer.from(mapJson).toString('base64')}`,
    ].join('\n');
    const stack = [
      'Error: react-stack-top-frame',
      '    at UnknownOwner (http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js:1:1)',
      '    at Card (http://localhost:5173/src/App.tsx:3:10)',
    ].join('\n');
    const componentFiber: FiberLike = { type: () => null, _debugStack: new Error() };
    // Attach the stack post-construction so the fixture matches a captured error.
    (componentFiber._debugStack as { stack: string }).stack = stack;
    const hostFiber: FiberLike = { type: 'section', _debugOwner: componentFiber };

    const result = await resolveSource(hostFiber, {}, () => Promise.resolve(transformedModule));
    expect(result).toEqual({
      file: 'code/lib/devtools-spike/demo/react-19/src/App.tsx',
      line: 20, // sourceLine 19 (0-based) + 1
      column: 2, // sourceColumn 1 (0-based) + 1
      regime: 'componentStack',
    });
  });

  it('loads external source maps relative to the frame URL', async () => {
    const mapJson = JSON.stringify({
      version: 3,
      sources: ['App.tsx'],
      file: WORKSPACE_FILE,
      mappings: encodeSegment([0, 0, 4, 2]),
    });
    const loader = (url: string): Promise<string | null> =>
      Promise.resolve(url.endsWith('.map') ? mapJson : '//# sourceMappingURL=App.tsx.map');
    const fiber: FiberLike = { type: 'button' };
    const stack = '    at Card (http://localhost:5173/src/App.tsx:1:1)';
    (fiber as { _debugStack?: unknown })._debugStack = { stack };
    const result = await resolveSource(fiber, {}, loader);
    expect(result).toEqual({
      file: 'code/lib/devtools-spike/demo/react-19/src/App.tsx',
      line: 5,
      column: 3,
      regime: 'componentStack',
    });
  });

  it('returns null when the module or map cannot be loaded', async () => {
    const stack = '    at Card (http://localhost:5173/src/App.tsx:1:1)';
    const fiberWithStack: FiberLike = { type: 'button' };
    (fiberWithStack as { _debugStack?: unknown })._debugStack = { stack };
    await expect(
      resolveSource(fiberWithStack, {}, () => Promise.resolve(null))
    ).resolves.toBeNull();
    await expect(
      resolveSource(fiberWithStack, {}, () => Promise.resolve('no map here'))
    ).resolves.toBeNull();
  });

  it('returns null when no owner carries usable debug data', async () => {
    const fiber: FiberLike = { type: 'button', return: { type: 'div' } };
    expect(await resolveSource(fiber, {})).toBeNull();
  });
});

describe('fiber walk', () => {
  it('walks the owner chain and stops at the first usable origin', () => {
    const origin: FiberLike = {
      type: () => null,
      _debugStack: { fileName: WORKSPACE_FILE, lineNumber: 1, columnNumber: 0 },
    };
    const deep: FiberLike = { type: 'span', _debugOwner: origin };
    const result = findNearestDebugOrigin(deep);
    expect(result?.kind).toBe('source');
  });
});

describe('legacy source reader', () => {
  it('never treats non-source shapes as locations', () => {
    const fiber: FiberLike = { type: 'button', _debugSource: new Error('not a source') };
    expect(readLegacySource({}, fiber)).toBeNull();
  });
});

describe('relativizeWorkspacePath', () => {
  it('cuts absolute repo paths to workspace-relative', () => {
    expect(relativizeWorkspacePath(WORKSPACE_FILE)).toBe(
      'code/lib/devtools-spike/demo/react-19/src/App.tsx'
    );
  });

  it('leaves non-workspace paths untouched rather than fabricating locality', () => {
    expect(relativizeWorkspacePath('/etc/hosts')).toBe('/etc/hosts');
  });
});

describe('parseStackFrames function names', () => {
  it('keeps the function name from named V8 frames', () => {
    const frames = parseStackFrames('    at Button (http://localhost:5173/src/Button.tsx:3:26)');
    expect(frames).toEqual([
      { url: 'http://localhost:5173/src/Button.tsx', line: 3, column: 26, functionName: 'Button' },
    ]);
  });

  it('leaves bare frames unnamed rather than inventing a function', () => {
    const frames = parseStackFrames('    at http://localhost:5173/src/index.js:1:1');
    expect(frames).toEqual([{ url: 'http://localhost:5173/src/index.js', line: 1, column: 1 }]);
  });
});

describe('findOwnRenderFrame', () => {
  it('prefers the child frame created by the component over the owner frame', () => {
    // react@19.2.8 semantics: the function fiber's _debugStack points at where
    // the element was created (the owner's JSX site, App.tsx), while the
    // rendered child's _debugStack starts with `at <ComponentName>` in the
    // component's own file.
    const buttonFn = function Button(): null {
      return null;
    };
    const componentFiber: FiberLike = {
      type: buttonFn,
      _debugStack: { stack: '    at App (http://localhost:5173/src/App.tsx:16:21)' },
    };
    componentFiber.child = {
      type: 'button',
      _debugStack: { stack: '    at Button (http://localhost:5173/src/Button.tsx:3:26)' },
    };

    const frame = findOwnRenderFrame(componentFiber, 'Button');
    expect(frame?.functionName).toBe('Button');
    expect(frame?.url).toBe('http://localhost:5173/src/Button.tsx');
  });

  it('searches siblings and depth when the first child is not the match', () => {
    const listFn = function List(): null {
      return null;
    };
    const componentFiber: FiberLike = {
      type: listFn,
      _debugStack: { stack: '    at App (http://localhost:5173/src/App.tsx:16:21)' },
    };
    const itemHost: FiberLike = {
      type: 'li',
      _debugStack: { stack: '    at Item (http://localhost:5173/src/List.tsx:12:10)' },
    };
    componentFiber.child = {
      type: 'ul',
      _debugStack: { stack: '    at List (http://localhost:5173/src/List.tsx:16:4)' },
      child: itemHost,
    };

    expect(findOwnRenderFrame(componentFiber, 'List')?.line).toBe(16);
    expect(findOwnRenderFrame(componentFiber, 'Item')?.line).toBe(12);
  });

  it('returns null when no child carries the component frame', () => {
    const componentFiber: FiberLike = {
      type: function Orphan(): null {
        return null;
      },
    };
    componentFiber.child = {
      type: 'div',
      _debugStack: { stack: '    at App (http://localhost:5173/src/App.tsx:16:21)' },
    };
    expect(findOwnRenderFrame(componentFiber, 'Orphan')).toBeNull();
  });
});

describe('resolveSource regime 2 — own render over creation site', () => {
  it('resolves the component file, not the owner file, when both symbolicate', async () => {
    // Regression: capture used to send App.tsx (the owner's creation site)
    // for a Button hover, which the write-glob guard then rejected.
    const buttonMap = JSON.stringify({
      version: 3,
      sources: ['components/Button.tsx'],
      file: WORKSPACE_FILE,
      // Frame (3, 26) in the transformed module → Button.tsx line 9.
      mappings: ';;' + encodeSegment([25, 0, 8, 0]),
    });
    const appMap = JSON.stringify({
      version: 3,
      sources: ['App.tsx'],
      file: WORKSPACE_FILE,
      // Frame (16, 21) in the transformed module → App.tsx line 13.
      mappings: ';;;;;;;;;;;;;;;' + encodeSegment([20, 0, 12, 6]),
    });
    const inline = (json: string): string =>
      `//# sourceMappingURL=data:application/json;base64,${Buffer.from(json).toString('base64')}`;
    const loader = (url: string): Promise<string | null> =>
      Promise.resolve(url.includes('Button') ? inline(buttonMap) : inline(appMap));

    const buttonFn = function Button(): null {
      return null;
    };
    const componentFiber: FiberLike = {
      type: buttonFn,
      _debugStack: { stack: '    at App (http://localhost:5173/src/App.tsx:16:21)' },
    };
    componentFiber.child = {
      type: 'button',
      _debugStack: {
        stack: '    at Button (http://localhost:5173/src/components/Button.tsx:3:26)',
      },
    };

    const result = await resolveSource(componentFiber, {}, loader);
    expect(result?.file).toBe('code/lib/devtools-spike/demo/react-19/src/components/Button.tsx');
    expect(result?.line).toBe(9);
    expect(result?.regime).toBe('componentStack');
  });
});
