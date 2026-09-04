/**
 * End-to-end tests for the Angular manifest generator.
 *
 * Uses memfs to mount a virtual filesystem (story files, component files,
 * compodoc JSON) so the full pipeline can run without real disk I/O.
 * Pattern mirrors how @storybook/react tests its componentManifest generator.
 */

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Redirect node:fs → memfs so the generator reads from a virtual filesystem.
// The factory form is required for node: built-ins in Vitest.
vi.mock('node:fs', async () => {
  const { fs } = await import('memfs');
  return { ...fs, default: fs };
});

// Mock empathic/package to control which package.json is resolved without
// relying on empathic's own node:fs calls (which bypass the memfs mock).
vi.mock('empathic/package', () => ({
  up: vi.fn(),
}));

import type { AngularComponentManifest } from './buildAngularComponentManifest.ts';
import { fsMocks, manifestEntries } from './fixtures.ts';
import { manifest } from './generator.ts';
import {
  COMPODOC_JSON_PATH,
  mockFindPackageJson,
  PACKAGE_JSON_PATH,
  ROOT,
  setupMemfsMocks,
} from './memfs-test-setup.ts';

/** Cast the manifest result to a typed record of AngularComponentManifest. */
function getComponents(result: Awaited<ReturnType<typeof manifest>>) {
  return Object.values(
    (result?.components?.components ?? {}) as Record<string, AngularComponentManifest>
  );
}

// ---------------------------------------------------------------------------
// Per-test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  setupMemfsMocks();
});

// ---------------------------------------------------------------------------
// Helper — run the generator against the virtual filesystem
// ---------------------------------------------------------------------------

async function runManifest(
  options: {
    extraFiles?: Record<string, string>;
    entries?: typeof manifestEntries;
  } = {}
) {
  const { extraFiles = {}, entries = manifestEntries } = options;

  if (Object.keys(extraFiles).length > 0) {
    vol.reset();
    vol.fromJSON({ ...fsMocks, ...extraFiles }, ROOT);
    mockFindPackageJson.mockReturnValue(PACKAGE_JSON_PATH);
  }

  return manifest({}, {
    manifestEntries: entries,
    watch: false,
    configDir: ROOT,
    outputDir: `${ROOT}/storybook-static`,
    cacheDir: `${ROOT}/.cache`,
    packageJson: {},
    presets: {},
  } as unknown as Parameters<typeof manifest>[1]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('manifest generator — happy path', () => {
  it('builds a manifest with the correct component id and name', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    expect(component).toBeDefined();
    expect(component?.name).toBe('ButtonComponent');
  });

  it('attaches compodoc selector to the manifest', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    expect(component?.selector).toBe('app-button');
  });

  it('marks standalone components', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    expect(component?.standalone).toBe(true);
  });

  it('attaches compodoc description', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    expect(component?.description).toBe('Primary UI component for user interaction.');
  });

  it('resolves import specifier from the nearest package.json name', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    expect(component?.import).toBe('import { ButtonComponent } from "@my-org/my-lib";');
  });

  it('uses the scoped package name in the import statement', async () => {
    const result = await runManifest({
      extraFiles: {
        [`${ROOT}/package.json`]: JSON.stringify({
          name: '@acme/ui-components',
        }),
      },
    });
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    expect(component?.import).toBe('import { ButtonComponent } from "@acme/ui-components";');
  });

  it('falls back to relative specifier when no package.json is found', async () => {
    mockFindPackageJson.mockReturnValue(undefined);
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    expect(component?.import).toContain('ButtonComponent');
    expect(component?.import).toContain('./button.component');
  });

  it('falls back to relative specifier when package.json has no name field', async () => {
    const result = await runManifest({
      extraFiles: {
        [`${ROOT}/package.json`]: JSON.stringify({ version: '1.0.0' }),
      },
    });
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    expect(component?.import).toContain('ButtonComponent');
    expect(component?.import).toContain('./button.component');
  });
});

describe('manifest generator — stories', () => {
  it('generates snippets for each story', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    expect(component?.stories.length).toBeGreaterThan(0);
  });

  it('generates a snippet using the component selector with story args', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    const primary = component?.stories.find((s) => s.name === 'Primary');
    // Primary has args: { label: "Click me", disabled: false }
    expect(primary?.snippet).toBe('<app-button label="Click me" [disabled]="false"></app-button>');
  });

  it('generates a correct snippet for the Disabled story', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    const disabled = component?.stories.find((s) => s.name === 'Disabled');
    // Disabled has args: { label: "Click me", disabled: true } — true renders as bare attribute
    expect(disabled?.snippet).toBe('<app-button label="Click me" disabled></app-button>');
  });

  it('generates a correct snippet for the WithOutput story', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    const withOutput = component?.stories.find((s) => s.name === 'With Output');
    // WithOutput has args: { clicked: undefined } — output renders as event binding
    expect(withOutput?.snippet).toBe('<app-button (clicked)="handleEvent($event)"></app-button>');
  });

  it('generates a snippet for every story entry', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    const storyNames = component?.stories.map((s) => s.name);
    expect(storyNames).toContain('Primary');
    expect(storyNames).toContain('Disabled');
    expect(storyNames).toContain('With Output');
    expect(storyNames).toContain('Custom Template');
  });

  it('uses render.template when @useTemplate is present and no docs.source.code is set', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    const custom = component?.stories.find((s) => s.name === 'Custom Template');
    expect(custom?.snippet).toBe('<app-button label="custom template"></app-button>');
  });

  it('prefers parameters.docs.source.code over render.template when @useTemplate is present', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    const docsSource = component?.stories.find((s) => s.name === 'Docs Source Template');
    expect(docsSource?.snippet).toBe('<app-button label="from docs source"></app-button>');
  });
});

describe('manifest generator — LibBtnDirective (compound selector)', () => {
  it('includes the directive in the manifest', async () => {
    const result = await runManifest();
    const directive = getComponents(result).find((c) => c.name === 'LibBtnDirective');
    expect(directive).toBeDefined();
  });

  it('attaches the compound selector', async () => {
    const result = await runManifest();
    const directive = getComponents(result).find((c) => c.name === 'LibBtnDirective');
    expect(directive?.selector).toBe('button[lib-btn], a[lib-btn]');
  });

  it('uses the first selector variant for compound selectors', async () => {
    const result = await runManifest();
    const directive = getComponents(result).find((c) => c.name === 'LibBtnDirective');
    const primary = directive?.stories.find((s) => s.name === 'Primary');
    expect(primary?.snippet).toBe('<button lib-btn></button>');
  });

  it('attaches the directive import from the package name', async () => {
    const result = await runManifest();
    const directive = getComponents(result).find((c) => c.name === 'LibBtnDirective');
    expect(directive?.import).toBe('import { LibBtnDirective } from "@my-org/my-lib";');
  });

  it('generates a correct compound snippet for the Secondary story with args', async () => {
    const result = await runManifest();
    const directive = getComponents(result).find((c) => c.name === 'LibBtnDirective');
    const secondary = directive?.stories.find((s) => s.name === 'Secondary');
    // Secondary has args: { variant: "secondary" }
    expect(secondary?.snippet).toBe('<button lib-btn variant="secondary"></button>');
  });
});

describe('manifest generator — compodoc summary', () => {
  it('exposes only the relevant top-level fields for ButtonComponent', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    const compodoc = component?.compodoc as unknown as Record<string, unknown> | undefined;
    expect(compodoc).toBeDefined();
    expect(compodoc?.name).toBe('ButtonComponent');
    expect(compodoc?.type).toBe('component');
    expect(compodoc?.selector).toBe('app-button');
    expect(compodoc?.standalone).toBe(true);
    expect(compodoc?.description).toBe('Primary UI component for user interaction.');

    // Internal Compodoc fields must be absent
    expect(compodoc).not.toHaveProperty('template');
    expect(compodoc).not.toHaveProperty('templateUrl');
    expect(compodoc).not.toHaveProperty('styleUrls');
    expect(compodoc).not.toHaveProperty('propertiesClass');
    expect(compodoc).not.toHaveProperty('methodsClass');
    expect(compodoc).not.toHaveProperty('hostBindings');
    expect(compodoc).not.toHaveProperty('hostListeners');
    expect(compodoc).not.toHaveProperty('hostDirectives');
    expect(compodoc).not.toHaveProperty('rawdescription');
  });

  it('exposes inputs with only their public API fields', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    const compodoc = component?.compodoc;
    const labelInput = compodoc?.inputs?.find((i: { name: string }) => i.name === 'label');
    expect(labelInput).toMatchObject({
      name: 'label',
      type: 'string',
      optional: true,
      defaultValue: "'Click me'",
      description: 'Text displayed inside the button.',
    });

    // Internal Property fields must be absent
    expect(labelInput).not.toHaveProperty('decorators');
    expect(labelInput).not.toHaveProperty('jsdoctags');
    expect(labelInput).not.toHaveProperty('actualName');
    expect(labelInput).not.toHaveProperty('rawdescription');
  });

  it('exposes outputs with only their public API fields', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    const compodoc = component?.compodoc;
    const clickedOutput = compodoc?.outputs?.find((o: { name: string }) => o.name === 'clicked');
    expect(clickedOutput).toMatchObject({
      name: 'clicked',
      type: 'EventEmitter<void>',
      description: 'Emitted when the user clicks the button.',
    });

    // Internal Property fields must be absent
    expect(clickedOutput).not.toHaveProperty('decorators');
    expect(clickedOutput).not.toHaveProperty('jsdoctags');
    expect(clickedOutput).not.toHaveProperty('rawdescription');
    expect(clickedOutput).not.toHaveProperty('optional');
  });

  it('uses renamed inputs/outputs keys instead of inputsClass/outputsClass', async () => {
    const result = await runManifest();
    const component = getComponents(result).find((c) => c.name === 'ButtonComponent');
    const compodoc = component?.compodoc;
    expect(compodoc).toHaveProperty('inputs');
    expect(compodoc).toHaveProperty('outputs');
    expect(compodoc).not.toHaveProperty('inputsClass');
    expect(compodoc).not.toHaveProperty('outputsClass');
  });
});

describe('manifest generator — compodoc missing', () => {
  it('returns an error when component not found in compodoc', async () => {
    const emptyCompodoc = JSON.stringify({
      components: [],
      directives: [],
      pipes: [],
      injectables: [],
      classes: [],
    });
    const result = await runManifest({
      extraFiles: { [COMPODOC_JSON_PATH]: emptyCompodoc },
    });
    const component = getComponents(result).find((c) => 'error' in c);
    expect(component?.error).toBeDefined();
    expect(component?.error?.name).toBe('Component not found in Compodoc output');
  });

  it('returns an error when no compodoc file exists', async () => {
    const buttonStories = fsMocks['./src/button/button.stories.ts'];
    const buttonComponent = fsMocks['./src/button/button.component.ts'];
    if (!buttonStories || !buttonComponent) throw new Error('missing fixtures');

    vol.reset();
    vol.fromJSON({
      [`${ROOT}/src/button/button.stories.ts`]: buttonStories,
      [`${ROOT}/src/button/button.component.ts`]: buttonComponent,
    });

    const buttonEntry = manifestEntries.find(
      (e) => e.importPath === './src/button/button.stories.ts'
    );
    if (!buttonEntry) throw new Error('missing fixture entry');

    const result = await manifest({}, {
      manifestEntries: [buttonEntry],
      watch: false,
      configDir: ROOT,
      outputDir: `${ROOT}/storybook-static`,
      cacheDir: `${ROOT}/.cache`,
      packageJson: {},
      presets: {},
    } as unknown as Parameters<typeof manifest>[1]);

    const component = getComponents(result)[0];
    expect(component?.error).toBeDefined();
  });
});

describe('manifest generator — meta.component missing', () => {
  it('returns an error when story has no component in meta', async () => {
    const storiesWithoutComponent = dedent`
      import type { Meta } from '@storybook/angular';
      const meta: Meta = { title: 'Components/Button' };
      export default meta;
      export const Primary = { args: {} };
    `;

    const result = await runManifest({
      extraFiles: {
        [`${ROOT}/src/button/button.stories.ts`]: storiesWithoutComponent,
      },
      entries: manifestEntries.filter((e) => e.importPath === './src/button/button.stories.ts'),
    });
    const component = getComponents(result)[0];
    expect(component?.error).toBeDefined();
    expect(component?.error?.name).toBe('No component found');
  });
});
