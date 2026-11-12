import { describe, expect, it } from 'vitest';

import { canonicalizeViteChunk, isGeneratedViteStoryLoader } from './turbosnap-output.ts';

const identities = new Map([
  ['assets/a-123.js', 'story-a'],
  ['assets/shared-123.js', 'shared'],
]);
const stories = new Map([['./src/A.stories.tsx', 'assets/a-123.js']]);
const canonicalize = (code: string) =>
  canonicalizeViteChunk({ code, fileName: 'assets/main.js' }, identities, stories);

describe('canonicalizeViteChunk', () => {
  it('cuts only the generated lazy story edge and retains a direct preview import', () => {
    const result = canonicalize(
      'import "./a-123.js"; const stories = { "./src/A.stories.tsx": () => import("./a-123.js") }; async function importFn(path) { return await stories[path](); } window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new Preview(importFn, annotations);const {PreviewWeb:Preview}=__STORYBOOK_MODULE_PREVIEW_API__;'
    );
    expect(result.edges).toEqual([
      { file: 'assets/a-123.js', story: undefined },
      { file: 'assets/a-123.js', story: './src/A.stories.tsx' },
    ]);
    expect(result.storyFiles.get('./src/A.stories.tsx')).toBe('assets/a-123.js');
  });

  it('rejects extra compiled importer and importFn references added after module parsing', () => {
    const loader =
      'const stories={"./src/A.stories.tsx":()=>import("./a-123.js")};async function importFn(path){return await stories[path]()}window.__STORYBOOK_PREVIEW__=window.__STORYBOOK_PREVIEW__||new Preview(importFn,annotations);const {PreviewWeb:Preview}=__STORYBOOK_MODULE_PREVIEW_API__;';
    expect(canonicalize(loader).storyFiles.size).toBe(1);
    expect(() =>
      canonicalize(
        loader.replace('new Preview(importFn,annotations)', 'new Eager(importFn,annotations)')
      )
    ).toThrow('unrecognized-story-loader-usage');
    expect(() => canonicalize(loader + 'stories["./src/A.stories.tsx"]();')).toThrow(
      'unrecognized-story-loader-usage'
    );
    expect(() => canonicalize(loader + 'importFn("./src/A.stories.tsx");')).toThrow(
      'unrecognized-story-loader-usage'
    );
    expect(() =>
      canonicalize(loader.replace('new Preview(importFn,annotations)', 'consumeAll(importFn)'))
    ).toThrow('unrecognized-story-loader-usage');
  });

  it('preserves arbitrary filename strings and every nonreference byte', () => {
    const result = canonicalize(
      'const label="./a-123.js"; import "./shared-123.js"; // ./a-123.js\n'
    );
    expect(result.code).toBe('const label="./a-123.js"; import "shared"; // ./a-123.js\n');
  });

  it('canonicalizes the exact generated preload map and rejects a modified helper', () => {
    const code =
      'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./a-123.js"])))=>i.map(i=>d[i]);';
    expect(canonicalize(code).code).toContain('m.f=["story-a"]');
    expect(() => canonicalize(code.replace('d[i]', 'd[i]+"suffix"'))).toThrow(
      'unknown-preload-map'
    );
  });

  it('rejects bare module specifiers even when an emitted file has that name', () => {
    expect(() =>
      canonicalizeViteChunk(
        { code: 'import "a-123.js";', fileName: 'assets/main.js' },
        identities,
        new Map()
      )
    ).toThrow('unresolved-output-reference');
  });

  it('keeps self-URL uses sensitive to the emitted filename', () => {
    expect(canonicalize('export function render(){return import.meta.url}').filenameSensitive).toBe(
      true
    );
    expect(canonicalize('function Example(){return new.target}').filenameSensitive).toBe(false);
  });

  it('tracks encoded and suffixed imports without discarding their suffix', () => {
    const result = canonicalize('import("./%61-123.js?global#anchor");');
    expect(result.edges).toEqual([{ file: 'assets/a-123.js', story: undefined }]);
    expect(result.code).toBe('import("story-a?global#anchor");');
  });

  it('rejects normalized offsets instead of erasing a real CRLF-prefixed change', () => {
    const source = '\r\n'.repeat(13) + 'globalThis.label="red"; import "./a-123.js";';
    for (const code of [source, source.replace('"red"', '"tan"')])
      expect(() => canonicalize(code)).toThrow('normalized-output-source');
    expect(canonicalize('globalThis.label="😀"; import "./a-123.js";').code).toBe(
      'globalThis.label="😀"; import "story-a";'
    );
  });

  it('rejects unknown computed imports', () => {
    expect(() => canonicalize('import(window.target)')).toThrow('dynamic-output-reference');
  });

  it('does not classify an eager import or an extra loader import as a story boundary', () => {
    expect(
      canonicalize('const stories={"./src/A.stories.tsx": import("./a-123.js")};').storyFiles.size
    ).toBe(0);
    expect(
      canonicalize(
        'const stories={"./src/A.stories.tsx": () => (import("./shared-123.js"),import("./a-123.js"))};'
      ).storyFiles.size
    ).toBe(0);
  });
});

it('requires the complete generated loader source before excluding its story imports', () => {
  const stories = new Map([['./A.stories.js', '/project/A.stories.js']]);
  const source = `const importers = {'./A.stories.js': () => import('/project/A.stories.js')}; export async function importFn(path) { return await importers[path](); }`;
  expect(isGeneratedViteStoryLoader(source, stories)).toBe(true);
  expect(isGeneratedViteStoryLoader(source + `importers['./A.stories.js']();`, stories)).toBe(
    false
  );
  expect(
    isGeneratedViteStoryLoader(
      source.replace('await importers[path]()', `await importers['./A.stories.js']()`),
      stories
    )
  ).toBe(false);
});
