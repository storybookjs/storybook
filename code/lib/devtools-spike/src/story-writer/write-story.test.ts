import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { expect, vi } from 'vitest';
import { afterEach, beforeEach, describe, it } from 'vitest';

import { loadCsf } from 'storybook/internal/csf-tools';
import { vol } from 'memfs';

import { serializeCapture } from '../serialize/serialize-capture.ts';
import type { CapturedProp, CapturePayload } from '../types.ts';
import { appendVariant, writeStoryFile } from './write-story.ts';

// Spy-only mock: keep the real `node:fs/promises` module shape, then redirect the calls used by
// the story writer (and this test's own `readFile` assertions) to `memfs` so disk state stays
// scoped to `vol`. Mirrors code/core/src/shared/open-service/server.test.ts.
vi.mock('node:fs/promises', { spy: true });

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  vi.mocked(mkdir).mockImplementation(
    memfs.fs.promises.mkdir as unknown as typeof import('node:fs/promises').mkdir
  );
  vi.mocked(readFile).mockImplementation(
    memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
  );
  vi.mocked(writeFile).mockImplementation(
    memfs.fs.promises.writeFile as unknown as typeof import('node:fs/promises').writeFile
  );
  vol.fromJSON({}, '/project');
});

afterEach(() => {
  vol.reset();
});

const STORY_FILE = '/project/demo/src/components/Button.stories.tsx';
const STORIES_GLOB = '/project/demo/src/**/*.stories.tsx';

const component = { componentName: 'Button', importPath: './Button' } as const;

const generation = {
  storyName: 'Primary',
  args: { label: 'Hello', disabled: false },
  argTypes: {},
  flagged: [],
};

const payloadWith = (props: CapturedProp[]): CapturePayload => ({
  componentName: 'Button',
  source: null,
  props,
  reactVersion: '19.2.8',
  capturedAt: 0,
});

const readBack = async (file: string): Promise<string> => {
  const content = await readFile(file, 'utf-8');
  return typeof content === 'string' ? content : content.toString();
};

describe('writeStoryFile', () => {
  it('creates a CSF file whose parsed meta and story args round-trip', async () => {
    await writeStoryFile(STORY_FILE, generation, {
      component,
      title: 'Demo/Button',
      storiesGlob: STORIES_GLOB,
    });

    const content = await readBack(STORY_FILE);
    expect(content).toContain("import { Button } from './Button';");
    expect(content).toContain('Demo/Button');
    expect(content).toContain('component: Button');

    const csf = loadCsf(content, {
      fileName: STORY_FILE,
      makeTitle: (title) => title || 'x',
    }).parse();
    expect(csf.getStoryExport('Primary')).toBeTruthy();
    expect(csf.stories.map((story) => story.name)).toEqual(['Primary']);
    // Args values are asserted on the printed source; quote style follows the user's Prettier
    // config, which the sandbox path cannot resolve.
    expect(content).toMatch(/label:\s*["']Hello["']/);
    expect(content).toMatch(/disabled:\s*false/);
  });

  it('supports compound component names in meta and imports', async () => {
    await writeStoryFile(STORY_FILE, generation, {
      component: { componentName: 'Card.List', importPath: './Card' },
      title: 'Demo/Card',
      storiesGlob: STORIES_GLOB,
    });

    const content = await readBack(STORY_FILE);
    expect(content).toContain("import { Card } from './Card';");
    expect(content).toContain('component: Card.List');
  });

  it('refuses to write outside the allowed stories glob', async () => {
    await expect(
      writeStoryFile('/project/elsewhere/src/Nope.stories.tsx', generation, {
        component,
        storiesGlob: STORIES_GLOB,
      })
    ).rejects.toThrow(/stories glob/);
    expect(vol.toJSON()['/project/elsewhere/src/Nope.stories.tsx']).toBeUndefined();
  });
});

describe('appendVariant', () => {
  const handFormatted = [
    "import { Button } from './Button';",
    '',
    '// Keep this comment — generation must not disturb it.',
    'export default {',
    '  component: Button,',
    '};',
    '',
    'export const Primary = {',
    '  // args were formatted by hand',
    "  args: { label: 'Hello' },",
    '};',
    '',
  ].join('\n');

  beforeEach(() => {
    vol.fromJSON({ [STORY_FILE]: handFormatted }, '/project');
  });

  it('appends the variant and preserves comments and formatting', async () => {
    await appendVariant(
      STORY_FILE,
      { ...generation, storyName: 'Secondary', args: { label: 'World' } },
      { storiesGlob: STORIES_GLOB }
    );

    const content = await readBack(STORY_FILE);
    expect(content).toContain('// Keep this comment — generation must not disturb it.');
    expect(content).toContain('// args were formatted by hand');
    expect(content).toContain('export const Secondary = {');
    expect(content).toContain('World');
    // The original content survives verbatim above the appended export.
    expect(content).toContain(handFormatted.trimEnd());

    const csf = loadCsf(content, {
      fileName: STORY_FILE,
      makeTitle: (title) => title || 'x',
    }).parse();
    expect(csf.getStoryExport('Primary')).toBeTruthy();
    expect(csf.getStoryExport('Secondary')).toBeTruthy();
  });

  it('merges the component import when the file does not import it yet', async () => {
    const withoutImport = handFormatted.replace("import { Button } from './Button';\n", '');
    vol.fromJSON({ [STORY_FILE]: withoutImport }, '/project');

    await appendVariant(
      STORY_FILE,
      { ...generation, storyName: 'Secondary' },
      {
        storiesGlob: STORIES_GLOB,
        component,
      }
    );

    const content = await readBack(STORY_FILE);
    expect(content).toContain("import { Button } from './Button';");
    expect(content).toContain('export const Secondary = {');
  });

  it('hard-fails on story-name collisions instead of overwriting', async () => {
    await expect(
      appendVariant(
        STORY_FILE,
        { ...generation, storyName: 'Primary' },
        {
          storiesGlob: STORIES_GLOB,
        }
      )
    ).rejects.toThrow(/already exists/);
  });

  it('refuses to write outside the allowed stories glob', async () => {
    await expect(
      appendVariant(STORY_FILE, generation, { storiesGlob: '/elsewhere/**' })
    ).rejects.toThrow(/stories glob/);
    expect(await readBack(STORY_FILE)).toBe(handFormatted);
  });
});

describe('payload → file round trip', () => {
  it('serializes a capture and writes only serializable args, flagging the rest', async () => {
    const payload = payloadWith([
      { name: 'label', kind: 'primitive', value: 'Save' },
      { name: 'count', kind: 'primitive', value: 2 },
      { name: 'meta', kind: 'object', value: { open: true } },
      { name: 'onClick', kind: 'function', value: () => {} },
      { name: 'slot', kind: 'unknown', value: { $$typeof: Symbol.for('react.element') } },
    ]);
    const generation = serializeCapture(payload, { existingStoryNames: [] });

    await writeStoryFile(STORY_FILE, generation, {
      component,
      title: 'Demo/Button',
      storiesGlob: STORIES_GLOB,
    });

    const content = await readBack(STORY_FILE);
    const csf = loadCsf(content, {
      fileName: STORY_FILE,
      makeTitle: (title) => title || 'x',
    }).parse();
    expect(csf.getStoryExport('Primary')).toBeTruthy();
    expect(content).toMatch(/label:\s*["']Save["']/);
    expect(content).toMatch(/count:\s*2/);
    expect(content).toMatch(/meta:\s*{\s*open:\s*true/);
    expect(content).toMatch(/argTypes:\s*{/);
    expect(content).toContain('onClick');
    expect(generation.flagged.map((flagged) => flagged.name)).toEqual(['onClick', 'slot']);
  });
});
