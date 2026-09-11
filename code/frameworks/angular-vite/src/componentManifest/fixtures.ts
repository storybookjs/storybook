/**
 * Shared fixture data for generator tests.
 *
 * Exports a virtual filesystem (`fsMocks`) built from real source files in
 * __testfixtures__/, and a pre-built story index (`storyIndex`) that mirrors
 * a realistic Angular library project.
 *
 * Pattern mirrors code/renderers/react/src/componentManifest/fixtures.ts
 * in the Storybook monorepo.
 */

// ?raw imports are resolved at transform time by Vitest — they never touch
// the mocked node:fs, so they always return the actual file contents.
import buttonComponentSource from './__testfixtures__/button/button.component.ts?raw';
import buttonStoriesSource from './__testfixtures__/button/button.stories.ts?raw';
import documentationJson from './__testfixtures__/documentation.json?raw';
import libBtnDirectiveSource from './__testfixtures__/lib-btn/lib-btn.directive.ts?raw';
import libBtnStoriesSource from './__testfixtures__/lib-btn/lib-btn.stories.ts?raw';

// ---------------------------------------------------------------------------
// Virtual filesystem — passed to vol.fromJSON() in tests
// ---------------------------------------------------------------------------

export const fsMocks: Record<string, string> = {
  // ── Project root ──────────────────────────────────────────────────────────
  './package.json': JSON.stringify({
    name: '@my-org/my-lib',
    version: '0.0.0',
  }),

  // ── ButtonComponent ───────────────────────────────────────────────────────
  './src/button/button.component.ts': buttonComponentSource,
  './src/button/button.stories.ts': buttonStoriesSource,

  // ── LibBtnDirective ───────────────────────────────────────────────────────
  './src/lib-btn/lib-btn.directive.ts': libBtnDirectiveSource,
  './src/lib-btn/lib-btn.stories.ts': libBtnStoriesSource,

  // ── Compodoc JSON ─────────────────────────────────────────────────────────
  './documentation.json': documentationJson,
};

// ---------------------------------------------------------------------------
// Story index — mirrors the Storybook index entries for these fixtures.
// Entries tagged "manifest" are eligible for manifest generation.
// ---------------------------------------------------------------------------

const MANIFEST = 'manifest';
const DEV = 'dev';
const TEST = 'test';
const AUTODOCS = 'autodocs';

const storyIndex = {
  v: 5,
  entries: {
    // Button stories
    'components-button--primary': {
      id: 'components-button--primary',
      title: 'Components/Button',
      name: 'Primary',
      importPath: './src/button/button.stories.ts',
      type: 'story' as const,
      subtype: 'story' as const,
      tags: [DEV, TEST, AUTODOCS, MANIFEST],
    },
    'components-button--disabled': {
      id: 'components-button--disabled',
      title: 'Components/Button',
      name: 'Disabled',
      importPath: './src/button/button.stories.ts',
      type: 'story' as const,
      subtype: 'story' as const,
      tags: [DEV, TEST, MANIFEST],
    },
    'components-button--with-output': {
      id: 'components-button--with-output',
      title: 'Components/Button',
      name: 'With Output',
      importPath: './src/button/button.stories.ts',
      type: 'story' as const,
      subtype: 'story' as const,
      tags: [DEV, TEST, MANIFEST],
    },
    'components-button--custom-template': {
      id: 'components-button--custom-template',
      title: 'Components/Button',
      name: 'Custom Template',
      importPath: './src/button/button.stories.ts',
      type: 'story' as const,
      subtype: 'story' as const,
      tags: [DEV, TEST, MANIFEST],
    },
    'components-button--docs-source-template': {
      id: 'components-button--docs-source-template',
      title: 'Components/Button',
      name: 'Docs Source Template',
      importPath: './src/button/button.stories.ts',
      type: 'story' as const,
      subtype: 'story' as const,
      tags: [DEV, TEST, MANIFEST],
    },
    // LibBtn directive stories
    // Note: CSF converts "Directives/LibBtn" → "directives-libbtn" (no hyphen)
    'directives-libbtn--primary': {
      id: 'directives-libbtn--primary',
      title: 'Directives/LibBtn',
      name: 'Primary',
      importPath: './src/lib-btn/lib-btn.stories.ts',
      type: 'story' as const,
      subtype: 'story' as const,
      tags: [DEV, TEST, MANIFEST],
    },
    'directives-libbtn--secondary': {
      id: 'directives-libbtn--secondary',
      title: 'Directives/LibBtn',
      name: 'Secondary',
      importPath: './src/lib-btn/lib-btn.stories.ts',
      type: 'story' as const,
      subtype: 'story' as const,
      tags: [DEV, TEST, MANIFEST],
    },
  },
} as const;

/** All story index entries tagged for manifest generation. */
export const manifestEntries = Object.values(storyIndex.entries).filter((e) =>
  e.tags.includes(MANIFEST)
);
