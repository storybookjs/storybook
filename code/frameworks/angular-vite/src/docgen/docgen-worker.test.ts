import { getComponentIdFromEntry } from 'storybook/internal/common';
import type { DocgenPayload, DocgenProvider, IndexEntry } from 'storybook/internal/types';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { buildDocgenPayload } from './build-docgen.ts';
import { createDocgenProvider } from './docgen-worker.ts';

vi.mock('node:fs', { spy: true });
// Spy-only: the real builder runs unless a test overrides it to exercise the provider's own wiring.
vi.mock('./build-docgen.ts', { spy: true });

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(existsSync).mockImplementation(memfs.fs.existsSync as typeof existsSync);
  vi.mocked(statSync).mockImplementation(memfs.fs.statSync as typeof statSync);
  vi.mocked(readFileSync).mockImplementation(memfs.fs.readFileSync as typeof readFileSync);
});

afterEach(() => {
  vol.reset();
  // `restoreAllMocks` does not put back the implementation behind a `spy: true` module mock, so a
  // per-test override would leak into every later test in the file.
  vi.mocked(buildDocgenPayload).mockReset();
  vi.restoreAllMocks();
});

const OUTPUT_DIR = '/workspace/docs';
const DOCUMENTATION_JSON = `${OUTPUT_DIR}/documentation.json`;
const STORY_PATH = resolve(process.cwd(), 'button.stories.ts');

const entry: IndexEntry = {
  id: 'button--default',
  name: 'Default',
  title: 'Button',
  type: 'story',
  subtype: 'story',
  importPath: './button.stories.ts',
};

const documentationJson = (input: string) =>
  JSON.stringify({
    components: [
      {
        name: 'ButtonComponent',
        type: 'component',
        description: '<p>Renders a button.</p>\n',
        inputsClass: [{ name: input, type: 'string', optional: false }],
        outputsClass: [],
        propertiesClass: [],
        methodsClass: [],
      },
    ],
  });

const STORY_FILE = `
  import { ButtonComponent } from './button.component';
  export default { title: 'Button', component: ButtonComponent };
  export const Default = {};
`;

const givenWorkspace = ({ withDocumentationJson = true } = {}) => {
  vol.fromNestedJSON({ [STORY_PATH]: STORY_FILE });
  vol.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (withDocumentationJson) {
    vol.writeFileSync(DOCUMENTATION_JSON, documentationJson('label'));
  }
};

const passthrough: DocgenProvider = async () => undefined;

const run = (next: DocgenProvider = passthrough, input = { entry }) =>
  createDocgenProvider({ outputDir: OUTPUT_DIR })(next)(input);

const downstream: DocgenPayload = {
  id: 'button',
  name: 'Downstream',
  path: './button.stories.ts',
  jsDocTags: {},
  argTypes: { caption: { name: 'caption' } },
};

describe('createDocgenProvider', () => {
  it('runs cold as a pure Node function: no dev server, no Vite, no Angular class loading', async () => {
    givenWorkspace();

    // The only input is a structured-cloneable options bag, exactly as it crosses the worker
    // boundary - no Storybook `Options`, no Vite config, no builder context.
    const payload = await createDocgenProvider(structuredClone({ outputDir: OUTPUT_DIR }))(
      passthrough
    )({ entry });

    expect(payload).toMatchObject({ name: 'ButtonComponent', description: 'Renders a button.' });
    expect(payload?.argTypes?.label).toBeDefined();
  });

  it('falls through for a file that is not a story', async () => {
    const next = vi.fn(passthrough);

    await expect(
      run(next, { entry: { ...entry, importPath: './button.component.ts' } })
    ).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
    expect(buildDocgenPayload).not.toHaveBeenCalled();
  });

  it('merges over downstream output on success', async () => {
    givenWorkspace();

    const payload = await run(async () => ({ ...downstream, somethingElse: 'kept' }));

    expect(payload).toMatchObject({ name: 'ButtonComponent', somethingElse: 'kept' });
    expect(payload?.argTypes?.label).toBeDefined();
    expect(payload?.argTypes?.caption).toBeUndefined();
  });

  it('keeps another provider`s payload when our own extraction fails', async () => {
    // No documentation.json: extraction fails while another provider has real data.
    givenWorkspace({ withDocumentationJson: false });
    const next = vi.fn<DocgenProvider>(async () => downstream);

    expect(await run(next)).toEqual(downstream);
    expect(next).toHaveBeenCalledOnce();
  });

  it('reports its own error only when no other provider described the component', async () => {
    givenWorkspace({ withDocumentationJson: false });

    const payload = await run();

    expect(payload?.error?.name).toBe('NoCompodocDocumentation');
    expect(payload?.id).toBe(getComponentIdFromEntry(entry));
  });

  it('lets an unexpected failure propagate, since core records it against this component', async () => {
    givenWorkspace();
    vi.mocked(buildDocgenPayload).mockImplementation(() => {
      throw new TypeError('compodoc entry is not iterable');
    });

    await expect(run()).rejects.toThrow('compodoc entry is not iterable');
  });

  it('re-reads documentation.json when Compodoc is re-run mid-session', async () => {
    givenWorkspace();
    const provider = createDocgenProvider({ outputDir: OUTPUT_DIR })(passthrough);

    expect((await provider({ entry }))?.argTypes?.label).toBeDefined();
    expect(
      vi.mocked(readFileSync).mock.calls.filter(([p]) => p === DOCUMENTATION_JSON)
    ).toHaveLength(1);
    // A second request for an unchanged file is served from the memo.
    await provider({ entry });
    expect(
      vi.mocked(readFileSync).mock.calls.filter(([p]) => p === DOCUMENTATION_JSON)
    ).toHaveLength(1);

    vol.writeFileSync(DOCUMENTATION_JSON, documentationJson('caption'));
    vol.utimesSync(DOCUMENTATION_JSON, new Date(), new Date(Date.now() + 5000));

    const updated = await provider({ entry });
    expect(updated?.argTypes?.caption).toBeDefined();
    expect(updated?.argTypes?.label).toBeUndefined();
  });

  it('reports a documentation.json created after the first miss', async () => {
    givenWorkspace({ withDocumentationJson: false });
    const provider = createDocgenProvider({ outputDir: OUTPUT_DIR })(passthrough);

    expect((await provider({ entry }))?.error?.name).toBe('NoCompodocDocumentation');

    vol.writeFileSync(DOCUMENTATION_JSON, documentationJson('label'));

    expect((await provider({ entry }))?.argTypes?.label).toBeDefined();
  });
});
