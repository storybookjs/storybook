import type { IndexEntry } from 'storybook/internal/types';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Redirect node:fs → memfs so docgen extraction reads from a virtual filesystem.
vi.mock('node:fs', async () => {
  const { fs } = await import('memfs');
  return { ...fs, default: fs };
});

import {
  COMPODOC_JSON_PATH,
  ROOT,
  setupMemfsMocks,
} from '../componentManifest/memfs-test-setup.ts';
import { buildDocgenPayload } from './buildDocgen.ts';

function makeEntry(importPath: string, title: string): IndexEntry {
  const componentId = title.split('/').at(-1)!.toLowerCase();
  return {
    id: `${componentId}--primary`,
    name: 'Primary',
    title,
    type: 'story',
    subtype: 'story',
    importPath,
  };
}

beforeEach(() => {
  setupMemfsMocks();
});

describe('buildDocgenPayload — happy path', () => {
  it('builds a docgen payload with the correct component id and name', async () => {
    const payload = await buildDocgenPayload({
      entry: makeEntry('./src/button/button.stories.ts', 'Components/Button'),
    });
    expect(payload?.id).toBe('button');
    expect(payload?.name).toBe('ButtonComponent');
    expect(payload?.path).toBe('./src/button/button.stories.ts');
  });

  it('attaches the compodoc selector, standalone flag, and change detection', async () => {
    const payload = await buildDocgenPayload({
      entry: makeEntry('./src/button/button.stories.ts', 'Components/Button'),
    });
    expect(payload?.selector).toBe('app-button');
    expect(payload?.standalone).toBe(true);
    expect(payload?.changeDetection).toBe('ChangeDetectionStrategy.OnPush');
  });

  it('attaches the compodoc description', async () => {
    const payload = await buildDocgenPayload({
      entry: makeEntry('./src/button/button.stories.ts', 'Components/Button'),
    });
    expect(payload?.description).toBe('Primary UI component for user interaction.');
  });

  it('attaches the compound selector for a directive', async () => {
    const payload = await buildDocgenPayload({
      entry: makeEntry('./src/lib-btn/lib-btn.stories.ts', 'Directives/LibBtn'),
    });
    expect(payload?.selector).toBe('button[lib-btn], a[lib-btn]');
  });
});

describe('buildDocgenPayload — compodoc summary', () => {
  it('exposes only the relevant top-level fields', async () => {
    const payload = await buildDocgenPayload({
      entry: makeEntry('./src/button/button.stories.ts', 'Components/Button'),
    });
    const compodoc = payload?.compodoc as Record<string, unknown> | undefined;
    expect(compodoc).toMatchObject({
      name: 'ButtonComponent',
      type: 'component',
      selector: 'app-button',
      standalone: true,
      description: 'Primary UI component for user interaction.',
    });

    // Internal Compodoc fields must be absent
    expect(compodoc).not.toHaveProperty('template');
    expect(compodoc).not.toHaveProperty('templateUrl');
    expect(compodoc).not.toHaveProperty('propertiesClass');
    expect(compodoc).not.toHaveProperty('methodsClass');
    expect(compodoc).not.toHaveProperty('rawdescription');
  });

  it('exposes inputs and outputs with only their public API fields', async () => {
    const payload = await buildDocgenPayload({
      entry: makeEntry('./src/button/button.stories.ts', 'Components/Button'),
    });
    const compodoc = payload?.compodoc as
      | {
          inputs: Array<{ name: string; [key: string]: unknown }>;
          outputs: Array<{ name: string; [key: string]: unknown }>;
        }
      | undefined;

    const labelInput = compodoc?.inputs.find((i) => i.name === 'label');
    expect(labelInput).toMatchObject({
      name: 'label',
      type: 'string',
      optional: true,
      defaultValue: "'Click me'",
      description: 'Text displayed inside the button.',
    });
    expect(labelInput).not.toHaveProperty('decorators');
    expect(labelInput).not.toHaveProperty('rawdescription');

    const clickedOutput = compodoc?.outputs.find((o) => o.name === 'clicked');
    expect(clickedOutput).toMatchObject({
      name: 'clicked',
      type: 'EventEmitter<void>',
      description: 'Emitted when the user clicks the button.',
    });
    expect(clickedOutput).not.toHaveProperty('optional');
  });
});

describe('buildDocgenPayload — compodoc missing', () => {
  it('returns an error when the component is not found in compodoc', async () => {
    setupMemfsMocks({
      [COMPODOC_JSON_PATH]: JSON.stringify({
        components: [],
        directives: [],
        pipes: [],
        injectables: [],
        classes: [],
      }),
    });

    const payload = await buildDocgenPayload({
      entry: makeEntry('./src/button/button.stories.ts', 'Components/Button'),
    });
    expect(payload?.error).toBeDefined();
    expect(payload?.error?.name).toBe('Component not found in Compodoc output');
  });

  it('returns an error when no compodoc file exists', async () => {
    setupMemfsMocks();
    const { vol } = await import('memfs');
    vol.unlinkSync(COMPODOC_JSON_PATH);

    const payload = await buildDocgenPayload({
      entry: makeEntry('./src/button/button.stories.ts', 'Components/Button'),
    });
    expect(payload?.error).toBeDefined();
  });
});

describe('buildDocgenPayload — meta.component missing', () => {
  it('returns an error when the story has no component in meta', async () => {
    setupMemfsMocks({
      [`${ROOT}/src/button/button.stories.ts`]: `
        export default { title: 'Components/Button' };
        export const Primary = { args: {} };
      `,
    });

    const payload = await buildDocgenPayload({
      entry: makeEntry('./src/button/button.stories.ts', 'Components/Button'),
    });
    expect(payload?.error).toBeDefined();
    expect(payload?.error?.name).toBe('No component found');
  });
});

describe('buildDocgenPayload — missing story file', () => {
  it('returns undefined when the story file cannot be read', async () => {
    const payload = await buildDocgenPayload({
      entry: makeEntry('./src/does-not-exist.stories.ts', 'Components/Missing'),
    });
    expect(payload).toBeUndefined();
  });
});
