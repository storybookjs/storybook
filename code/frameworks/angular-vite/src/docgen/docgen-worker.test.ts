import { getComponentIdFromEntry } from 'storybook/internal/common';
import type { DocgenPayload, DocgenProvider, IndexEntry } from 'storybook/internal/types';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { ensureCompodocDocumentation } from '../compodoc/ensure-documentation.ts';
import { buildDocgenPayload } from './build-docgen.ts';
import { createDocgenProvider } from './docgen-worker.ts';

vi.mock('node:fs', { spy: true });
// Spy-only: the real builder runs unless a test overrides it to exercise the provider's own wiring.
vi.mock('./build-docgen.ts', { spy: true });
// Generation is covered next to the lock; here it only has to happen before anything is served.
vi.mock('../compodoc/ensure-documentation.ts', { spy: true });

/** Whether the mocked generation should publish a documentation.json, set per test. */
let generationWrites = false;

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(existsSync).mockImplementation(memfs.fs.existsSync as typeof existsSync);
  vi.mocked(statSync).mockImplementation(memfs.fs.statSync as typeof statSync);
  vi.mocked(readFileSync).mockImplementation(memfs.fs.readFileSync as typeof readFileSync);
  generationWrites = false;
  vi.mocked(ensureCompodocDocumentation).mockImplementation(async () => {
    if (generationWrites) {
      vol.writeFileSync(DOCUMENTATION_JSON, documentationJson('label'));
    }
  });
});

afterEach(() => {
  vol.reset();
  // `restoreAllMocks` does not put back the implementation behind a `spy: true` module mock, so a
  // per-test override would leak into every later test in the file.
  vi.mocked(buildDocgenPayload).mockReset();
  vi.mocked(ensureCompodocDocumentation).mockReset();
  vi.restoreAllMocks();
});

const OUTPUT_DIR = '/workspace/docs';
const DOCUMENTATION_JSON = join(OUTPUT_DIR, 'documentation.json');
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

const providerOptions = {
  outputDir: OUTPUT_DIR,
  compodocArgs: ['-e', 'json', '-d', OUTPUT_DIR],
  workspaceRoot: process.cwd(),
  tsconfig: 'tsconfig.json',
};

const createProvider = async (next: DocgenProvider = passthrough) =>
  (await createDocgenProvider(providerOptions))(next);

const run = async (next: DocgenProvider = passthrough, input = { entry }) =>
  (await createProvider(next))(input);

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
    const middleware = await createDocgenProvider(structuredClone(providerOptions));
    const payload = await middleware(passthrough)({ entry });

    expect(payload).toMatchObject({ name: 'ButtonComponent', description: 'Renders a button.' });
    expect(payload?.argTypes?.label).toBeDefined();
  });

  it('triggers Compodoc once per worker and awaits it before serving anything', async () => {
    givenWorkspace({ withDocumentationJson: false });
    // Whatever the trigger produces has to be on disk by the time the first request is answered,
    // which is only true because the run is awaited during construction rather than per request.
    generationWrites = true;
    const provider = await createProvider();

    const payload = await provider({ entry });
    await provider({ entry });

    expect(ensureCompodocDocumentation).toHaveBeenCalledOnce();
    expect(ensureCompodocDocumentation).toHaveBeenCalledWith(
      expect.objectContaining({
        outputDir: OUTPUT_DIR,
        compodocArgs: ['-e', 'json', '-d', OUTPUT_DIR],
      })
    );
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
    const provider = await createProvider();

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
    const provider = await createProvider();

    expect((await provider({ entry }))?.error?.name).toBe('NoCompodocDocumentation');

    vol.writeFileSync(DOCUMENTATION_JSON, documentationJson('label'));

    expect((await provider({ entry }))?.argTypes?.label).toBeDefined();
  });
});
