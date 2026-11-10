import { readFile, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile, JsPackageManager } from 'storybook/internal/common';

import { fs, vol } from 'memfs';
import { resolve } from 'pathe';
import { dedent } from 'ts-dedent';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { sveltekitMockingBeforeEach } from './sveltekit-mocking-before-each.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const project = resolve('sveltekit-project');
const previewConfigPath = resolve(project, '.storybook/preview.ts');
const csfPath = resolve(project, 'src/Page.stories.ts');
// Svelte CSF files resolve `svelte/compiler` from their own path, so this one is in the repository
const sveltePath = resolve(__dirname, 'Page.stories.svelte');
const options = {
  packageManager: vi.mocked(JsPackageManager.prototype),
  mainConfig: { stories: [], framework: '@storybook/sveltekit' },
  mainConfigPath: resolve(project, '.storybook/main.ts'),
  configDir: resolve(project, '.storybook'),
  storybookVersion: '11.0.0',
  previewConfigPath,
};

const migrate = async (files: { preview?: string; csf?: string; svelte?: string }) => {
  vol.fromJSON({
    [previewConfigPath]: files.preview ?? '',
    ...(files.csf !== undefined ? { [csfPath]: files.csf } : {}),
    ...(files.svelte !== undefined ? { [sveltePath]: files.svelte } : {}),
  });
  const storiesPaths = [
    ...(files.csf !== undefined ? [csfPath] : []),
    ...(files.svelte !== undefined ? [sveltePath] : []),
  ];
  const result = await checkFix(sveltekitMockingBeforeEach, { ...options, storiesPaths });
  const failures = result
    ? await runFix(sveltekitMockingBeforeEach, { ...options, storiesPaths, result })
    : [];
  const read = (path: string, given?: string) =>
    given === undefined ? undefined : (fs.readFileSync(path, 'utf8') as string);
  return {
    applies: !!result,
    failures: failures.map(({ message }) => message),
    preview: read(previewConfigPath, files.preview),
    csf: read(csfPath, files.csf),
    svelte: read(sveltePath, files.svelte),
  };
};

describe('sveltekit-mocking-before-each', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(formatExistingFile).mockImplementation(async (_path, source) => source);
  });

  afterEach(() => {
    vi.mocked(readFile).mockRestore();
    vi.mocked(writeFile).mockRestore();
  });

  describe('check', () => {
    it('applies to SvelteKit projects on Storybook 11 whose files set sveltekit_experimental', async () => {
      const story =
        'export default {}; export const A = { parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } } };';
      vol.fromJSON({ [previewConfigPath]: '', [csfPath]: story });
      const storiesPaths = [csfPath];

      expect(
        await checkFix(sveltekitMockingBeforeEach, { ...options, storiesPaths })
      ).not.toBeNull();
      expect(
        await checkFix(sveltekitMockingBeforeEach, {
          ...options,
          storiesPaths,
          mainConfig: { stories: [], framework: '@storybook/svelte-vite' },
        })
      ).toBeNull();
      expect(
        await checkFix(sveltekitMockingBeforeEach, {
          ...options,
          storiesPaths,
          storybookVersion: '10.3.0',
        })
      ).toBeNull();

      fs.writeFileSync(csfPath, 'export default {}; export const A = {};');
      expect(await checkFix(sveltekitMockingBeforeEach, { ...options, storiesPaths })).toBeNull();
    });
  });

  describe('CSF', () => {
    it('rewrites every key of the table into beforeEach', async () => {
      const { failures, csf } = await migrate({
        csf: dedent`
          import { expect, fn } from 'storybook/test';

          import Page from './Page.svelte';

          export default { component: Page };

          export const State = {
            parameters: {
              sveltekit_experimental: {
                state: {
                  page: { data: { user: 'Ada' }, url: new URL('http://localhost/a') },
                  navigating: { to: { url: new URL('http://localhost/b') }, type: 'link' },
                  updated: { current: true },
                },
              },
            },
          };

          export const Navigation = {
            parameters: {
              sveltekit_experimental: {
                navigation: {
                  goto: (url) => console.log(url),
                  invalidate: onInvalidate,
                  afterNavigate: { type: 'link' },
                },
              },
            },
          };

          const onLink = fn();

          export const Hrefs = {
            parameters: {
              sveltekit_experimental: {
                hrefs: {
                  '/settings': onLink,
                  '^/users/.*': { callback: onLink, asRegex: true },
                },
              },
            },
          };

          const onSubmit = fn();

          export const Forms = {
            parameters: {
              sveltekit_experimental: { forms: { enhance: onSubmit } },
            },
          };
        `,
      });

      expect(failures).toEqual([]);
      expect(csf).toMatchInlineSnapshot(`
        "import { expect, fn, mocked } from 'storybook/test';

        import Page from './Page.svelte';
        import { page, navigating, updated } from '$app/state';
        import { goto, invalidate } from '$app/navigation';
        import { link, setAfterNavigate } from '@storybook/sveltekit/navigation.mock';
        import { formAction } from '@storybook/sveltekit/forms.mock';

        export default { component: Page };

        export const State = {
          beforeEach() {
            page.data = { user: 'Ada' };
            page.url = new URL('http://localhost/a');
            navigating.to = { url: new URL('http://localhost/b') };
            navigating.type = 'link';
            Object.assign(updated, { current: true });
          },
        };

        export const Navigation = {
          beforeEach() {
            mocked(goto).mockImplementation(async (url) => {
              console.log(url);
            });
            mocked(invalidate).mockImplementation(async (...args) => {
              onInvalidate(...args);
            });
            setAfterNavigate({ type: 'link' });
          },
        };

        const onLink = fn();

        export const Hrefs = {
          beforeEach() {
            link.mockImplementation((href, event) => {
              if (href === '/settings') onLink(href, event);
              if (new RegExp('^/users/.*').test(href)) onLink(href, event);
            });
          },
        };

        const onSubmit = fn();

        export const Forms = {
          beforeEach() {
            formAction.mockImplementation(async (submission) => {
              onSubmit();
              return { type: 'success', status: 200 };
            });
          },
        };"
      `);
    });

    it('replaces a const goto = fn() with the goto of $app/navigation, and drops what did nothing', async () => {
      const { csf } = await migrate({
        csf: dedent`
          import { expect, fn } from 'storybook/test';

          import Page from './Page.svelte';

          export default { component: Page };

          const goto = fn();

          export const Goto = {
            parameters: {
              layout: 'centered',
              sveltekit_experimental: {
                navigation: { goto, invalidateAll: fn(), refreshAll: () => {}, beforeNavigate: () => {} },
                forms: { enhance: () => {} },
              },
            },
            play: async () => {
              await expect(goto).toHaveBeenCalledWith('/login');
            },
          };
        `,
      });

      expect(csf).toMatchInlineSnapshot(`
        "import { expect } from 'storybook/test';

        import Page from './Page.svelte';
        import { goto } from '$app/navigation';

        export default { component: Page };

        export const Goto = {
          parameters: {
            layout: 'centered',
          },
          play: async () => {
            await expect(goto).toHaveBeenCalledWith('/login');
          },
        };"
      `);
    });

    it('adds the statements at the start of an existing beforeEach', async () => {
      const { csf } = await migrate({
        csf: dedent`
          import Page from './Page.svelte';

          export default {
            component: Page,
            beforeEach: setup,
            parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } },
          };

          export const Block = {
            async beforeEach() {
              await setup();
            },
            parameters: { sveltekit_experimental: { state: { page: { status: 2 } } } },
          };

          export const Expression = {
            beforeEach: () => setup(),
            parameters: { sveltekit_experimental: { state: { page: { status: 3 } } } },
          };

          export const List = {
            beforeEach: [setup],
            parameters: { sveltekit_experimental: { state: { page: { status: 4 } } } },
          };
        `,
      });

      expect(csf).toMatchInlineSnapshot(`
        "import Page from './Page.svelte';
        import { page } from '$app/state';

        export default {
          component: Page,
          beforeEach: [() => {
            page.status = 1;
          }, ...[setup].flat()],
        };

        export const Block = {
          async beforeEach() {
            page.status = 2;
            await setup();
          },
        };

        export const Expression = {
          beforeEach: () => {
            page.status = 3;
            return setup();
          },
        };

        export const List = {
          beforeEach: [() => {
            page.status = 4;
          }, setup],
        };"
      `);
    });

    it('keeps a shorthand beforeEach, and resets a function that a story stops the meta from implementing', async () => {
      const { csf } = await migrate({
        csf: dedent`
          import { fn } from 'storybook/test';

          const beforeEach = () => console.log('shared');

          export default {
            parameters: {
              sveltekit_experimental: {
                navigation: { goto: (url) => console.log(url) },
                forms: { enhance: () => console.log('submitted') },
              },
            },
          };

          export const Shorthand = {
            beforeEach,
            parameters: { sveltekit_experimental: { state: { page: { status: 1, data: undefined } } } },
          };

          export const Silent = {
            parameters: {
              sveltekit_experimental: { navigation: { goto: fn() }, forms: { enhance: () => {} } },
            },
          };
        `,
      });

      expect(csf).toMatchInlineSnapshot(`
        "import { mocked } from 'storybook/test';
        import { page } from '$app/state';
        import { goto } from '$app/navigation';
        import { formAction } from '@storybook/sveltekit/forms.mock';

        const beforeEach = () => console.log('shared');

        export default {
          beforeEach() {
            mocked(goto).mockImplementation(async (url) => {
              console.log(url);
            });
            formAction.mockImplementation(async (submission) => {
              console.log('submitted');
              return { type: 'success', status: 200 };
            });
          },
        };

        export const Shorthand = {
          beforeEach: [() => {
            page.status = 1;
          }, beforeEach],
        };

        export const Silent = {
          beforeEach() {
            mocked(goto).mockImplementation(async () => {});
            formAction.mockImplementation(async () => ({ type: 'success', status: 200 }));
          },
        };"
      `);
    });

    it('reports a story that spreads another one and would lose its beforeEach', async () => {
      const { failures } = await migrate({
        csf: dedent`
          export default {};

          export const Base = {
            parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } },
          };
          export const Extended = { ...Base, beforeEach: () => {} };
          export const Spreads = {
            ...Base,
            parameters: { sveltekit_experimental: { state: { page: { status: 2 } } } },
          };
        `,
      });

      expect(failures).toMatchInlineSnapshot(`
        [
          "Could not migrate \`sveltekit_experimental\`, so this file is unchanged. line 6: Spreads \`Base\`, whose \`sveltekit_experimental\` moves into its \`beforeEach\`, which this story's own \`beforeEach\` replaces. line 7: The object spreads another one, whose \`beforeEach\` the new \`beforeEach\` would replace. Migrate it by hand: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#sveltekit-sveltekit_experimental-parameters-removed",
        ]
      `);
    });

    it('migrates CSF factories', async () => {
      const { csf } = await migrate({
        csf: dedent`
          import preview from '#.storybook/preview';

          import Page from './Page.svelte';

          const meta = preview.meta({ component: Page });

          export const Primary = meta.story({
            parameters: { sveltekit_experimental: { state: { page: { status: 200 } } } },
          });
        `,
      });

      expect(csf).toMatchInlineSnapshot(`
        "import preview from '#.storybook/preview';

        import Page from './Page.svelte';
        import { page } from '$app/state';

        const meta = preview.meta({ component: Page });

        export const Primary = meta.story({
          beforeEach() {
            page.status = 200;
          },
        });"
      `);
    });

    it('imports under an alias when the name is taken, and reuses an import the file has', async () => {
      const { csf } = await migrate({
        csf: dedent`
          import { goto as navigate } from '$app/navigation';

          import Page from './Page.svelte';

          export default { component: Page };

          const page = { status: 404 };

          export const Taken = {
            parameters: {
              sveltekit_experimental: {
                state: { page },
                navigation: { goto: (url) => console.log(url) },
              },
            },
          };
        `,
      });

      expect(csf).toMatchInlineSnapshot(`
        "import { goto as navigate } from '$app/navigation';

        import Page from './Page.svelte';
        import { page as _page } from '$app/state';
        import { mocked } from 'storybook/test';

        export default { component: Page };

        const page = { status: 404 };

        export const Taken = {
          beforeEach() {
            Object.assign(_page, page);
            mocked(navigate).mockImplementation(async (url) => {
              console.log(url);
            });
          },
        };"
      `);
    });

    it('spreads the meta value into a story object that the old parameters merged with it', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default {
            parameters: { sveltekit_experimental: { state: { page: { data: { user: 'Ada' } } } } },
          };

          export const Merged = {
            parameters: { sveltekit_experimental: { state: { page: { data: { flag: true } } } } },
          };
        `,
      });

      expect(csf).toMatchInlineSnapshot(`
        "import { page } from '$app/state';

        export default {
          beforeEach() {
            page.data = { user: 'Ada' };
          },
        };

        export const Merged = {
          beforeEach() {
            page.data = { ...page.data, flag: true };
          },
        };"
      `);
    });

    it('renders the stories in iframes on docs pages when autodocs would share the mocks', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default { tags: ['autodocs'] };

          export const A = {
            parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } },
          };

          export const B = {};
        `,
      });

      expect(csf).toMatchInlineSnapshot(`
        "import { page } from '$app/state';

        export default { tags: ['autodocs'], parameters: { docs: { story: { inline: false } } } };

        export const A = {
          beforeEach() {
            page.status = 1;
          },
        };

        export const B = {};"
      `);
    });

    it('renders in iframes a meta whose docs parameters come from a variable', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default { tags: ['autodocs'], parameters: { docs: sharedDocs } };

          export const A = { parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } } };
          export const B = {};
        `,
      });

      expect(csf).toMatchInlineSnapshot(`
        "import { page } from '$app/state';

        export default { tags: ['autodocs'], parameters: { docs: { ...sharedDocs, story: { ...(sharedDocs as { story?: object } | undefined)?.story, inline: false } } } };

        export const A = { beforeEach() {
          page.status = 1;
        } };
        export const B = {};"
      `);
    });

    it('renders in iframes the stories of a file that an MDX docs page shows, also with one story', async () => {
      const mdxPath = resolve(project, 'src/Page.mdx');
      const story = dedent`
        export default {};
        export const A = { parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } } };
      `;
      vol.fromJSON({
        [previewConfigPath]: '',
        [csfPath]: story,
        [mdxPath]:
          "import { Meta, Story as Example } from '@storybook/addon-docs/blocks';\nimport * as PageStories from './Page.stories';\n\n<Meta of={PageStories} />\n\n<Example of={PageStories.A} />",
      });
      const storiesPaths = [csfPath, mdxPath];
      const result = await checkFix(sveltekitMockingBeforeEach, { ...options, storiesPaths });
      await runFix(sveltekitMockingBeforeEach, { ...options, storiesPaths, result: result! });

      expect(fs.readFileSync(csfPath, 'utf8')).toContain(
        'parameters: { docs: { story: { inline: false } } }'
      );
    });

    it('reports what it cannot read statically, and leaves the file unchanged', async () => {
      const story = dedent`
        import { shared } from './shared';

        export default {};

        const params = { sveltekit_experimental: { state: { page: { status: 1 } } } };

        export const Identifier = { parameters: { sveltekit_experimental: shared } };
        export const Spread = { parameters: { sveltekit_experimental: { ...shared } } };
        export const Shared = { parameters: params };
        export const Hrefs = {
          parameters: { sveltekit_experimental: { hrefs: { '/a': cb }, forms: { enhance: (event) => event } } },
        };
        export const Reads = {
          play: ({ parameters }) => parameters.sveltekit_experimental,
        };
      `;
      const { failures, csf } = await migrate({ csf: story });

      expect(csf).toBe(story);
      expect(failures).toMatchInlineSnapshot(`
        [
          "Could not migrate \`sveltekit_experimental\`, so this file is unchanged. line 5: \`sveltekit_experimental\` is not in the \`parameters\` object literal of a story, the meta or the preview, but in a shared variable or a helper function, so the fix can't tell which stories use it. line 7: \`sveltekit_experimental\` is not an object literal, so its keys can't be read. line 8: \`sveltekit_experimental\` spreads another object. line 11: \`forms.enhance\` reads the submit event. \`formAction\` receives \`{ action, formData, formElement, submitter }\` instead. line 14: Reads \`parameters.sveltekit_experimental\`, which no longer exists. Assert on the mocks from their modules instead, for example \`expect(goto)\`. Migrate it by hand: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#sveltekit-sveltekit_experimental-parameters-removed",
        ]
      `);
    });
  });

  describe('preview', () => {
    it('migrates a preview object, and one made of named exports', async () => {
      const objectPreview = await migrate({
        preview: dedent`
          import { definePreview } from '@storybook/sveltekit';

          export default definePreview({
            parameters: {
              layout: 'centered',
              sveltekit_experimental: { state: { page: { url: new URL('http://localhost/') } } },
            },
          });
        `,
      });
      const namedPreview = await migrate({
        preview: dedent`
          export const parameters = {
            sveltekit_experimental: { hrefs: { '/': () => console.log('home') } },
          };
        `,
      });

      expect(objectPreview.preview).toMatchInlineSnapshot(`
        "import { definePreview } from '@storybook/sveltekit';
        import { page } from '$app/state';

        export default definePreview({
          parameters: {
            layout: 'centered',
          },
          beforeEach() {
            page.url = new URL('http://localhost/');
          },
        });"
      `);
      expect(namedPreview.preview).toMatchInlineSnapshot(`
        "import { link } from '@storybook/sveltekit/navigation.mock';

        export function beforeEach() {
          link.mockImplementation((href, event) => {
            if (href === '/') console.log('home');
          });
        }"
      `);
    });

    it('adds to a beforeEach that the preview exports by name', async () => {
      const { preview } = await migrate({
        preview: dedent`
          const beforeEach = () => {
            document.body.dataset.theme = 'light';
          };

          export { beforeEach };

          export const parameters = {
            layout: 'centered',
            sveltekit_experimental: { state: { page: { status: 200 } } },
          };
        `,
      });

      expect(preview).toMatchInlineSnapshot(`
        "import { page } from '$app/state';

        const beforeEach = () => {
          page.status = 200;
          document.body.dataset.theme = 'light';
        };

        export { beforeEach };

        export const parameters = {
          layout: 'centered',
        };"
      `);
    });

    it('keeps the other declarations of the statement that declares the parameters', async () => {
      const { preview } = await migrate({
        preview: dedent`
          export const parameters = { sveltekit_experimental: { state: { page: { status: 1 } } } },
            decorators = [];
        `,
      });

      expect(preview).toContain('decorators = []');
      expect(preview).toContain('export function beforeEach() {');
    });

    it('reports a preview that exports an imported beforeEach', async () => {
      const { failures } = await migrate({
        preview: dedent`
          import { beforeEach } from './setup';
          export { beforeEach };
          export const parameters = { sveltekit_experimental: { state: { page: { status: 1 } } } };
        `,
      });

      expect(failures[0]).toContain('exports a `beforeEach` from another module');
    });

    it('warns in the prompt that a preview setting the mocks makes docs pages fail', async () => {
      vol.fromJSON({
        [previewConfigPath]: `export default { parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } } };`,
      });
      const result = await checkFix(sveltekitMockingBeforeEach, { ...options, storiesPaths: [] });

      expect(sveltekitMockingBeforeEach.prompt(result!)).toContain(
        'docs pages with several stories will fail'
      );
    });

    it('reports a story hrefs that the old parameters merged with the preview hrefs', async () => {
      const { failures } = await migrate({
        preview: `export default { parameters: { sveltekit_experimental: { hrefs: { '/': cb } } } };`,
        csf: `export default {}; export const A = { parameters: { sveltekit_experimental: { hrefs: { '/a': cb } } } };`,
      });

      expect(failures).toMatchInlineSnapshot(`
        [
          "Could not migrate \`sveltekit_experimental\`, so this file is unchanged. line 1: \`hrefs\` is also set on a level around this one. The old parameters merged both objects, and \`link.mockImplementation()\` replaces the earlier one. Migrate it by hand: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#sveltekit-sveltekit_experimental-parameters-removed",
        ]
      `);
    });
  });

  describe('Svelte CSF', () => {
    it('migrates defineMeta and <Story> parameters, and imports in <script module>', async () => {
      const { failures, svelte } = await migrate({
        svelte: dedent`
          <script module>
            import { defineMeta } from '@storybook/sveltekit';
            import { expect, fn } from 'storybook/test';

            import Header from './Header.svelte';

            const goto = fn();

            const { Story } = defineMeta({
              component: Header,
              parameters: {
                sveltekit_experimental: {
                  state: { page: { url: new URL('http://localhost/dashboard') } },
                },
              },
            });
          </script>

          <Story
            name="Logged in"
            parameters={{
              sveltekit_experimental: {
                state: { page: { data: { user: { name: 'Ada' } } } },
                navigation: { goto },
                hrefs: { '/settings': (to) => console.log(to) },
              },
            }}
            play={async ({ canvas, userEvent }) => {
              await userEvent.click(canvas.getByRole('button', { name: 'Log out' }));
              await expect(goto).toHaveBeenCalledWith('/login');
            }}
          />
        `,
      });

      expect(failures).toEqual([]);
      expect(svelte).toMatchInlineSnapshot(`
        "<script module>
          import { defineMeta } from '@storybook/sveltekit';
          import { expect } from 'storybook/test';

          import Header from './Header.svelte';
          import { page } from '$app/state';
          import { goto } from '$app/navigation';
          import { link } from '@storybook/sveltekit/navigation.mock';

          const { Story } = defineMeta({
            component: Header,
            beforeEach() {
              page.url = new URL('http://localhost/dashboard');
            },
          });
        </script>

        <Story
          name="Logged in"
          beforeEach={() => {
            page.data = { user: { name: 'Ada' } };
            link.mockImplementation((href, event) => {
              if (href === '/settings') console.log(href);
            });
          }}
          play={async ({ canvas, userEvent }) => {
            await userEvent.click(canvas.getByRole('button', { name: 'Log out' }));
            await expect(goto).toHaveBeenCalledWith('/login');
          }}
        />"
      `);
    });

    it('merges into <Story beforeEach>, keeps other parameters, and migrates Svelte CSF 4 with TypeScript', async () => {
      const { svelte } = await migrate({
        svelte: dedent`
          <script module lang="ts">
            import preview from '#.storybook/preview';

            import Header from './Header.svelte';

            const { Story } = preview.meta({ component: Header });
          </script>

          <Story
            name="Existing"
            beforeEach={() => console.log('setup')}
            parameters={{ sveltekit_experimental: { state: { page: { status: 1 as number } } } }}
          />

          <Story
            name="Kept"
            parameters={{
              layout: 'fullscreen',
              sveltekit_experimental: { navigation: { goto: (url: string | URL) => console.log(url) } },
            }}
          />
        `,
      });

      expect(svelte).toMatchInlineSnapshot(`
        "<script module lang="ts">
          import preview from '#.storybook/preview';

          import Header from './Header.svelte';
          import { page } from '$app/state';
          import { goto } from '$app/navigation';
          import { mocked } from 'storybook/test';

          const { Story } = preview.meta({ component: Header });
        </script>

        <Story
          name="Existing"
          beforeEach={() => {
            page.status = 1 as number;
            return console.log('setup');
          }}
        />

        <Story
          name="Kept"
          parameters={{
            layout: 'fullscreen',
          }}
          beforeEach={() => {
            mocked(goto).mockImplementation((async (url: string | URL) => {
              console.log(url);
            }) as typeof goto);
          }}
        />"
      `);
    });

    it('reports a sveltekit_experimental in a shared variable and a play function that reads it', async () => {
      const story = dedent`
        <script module>
          import { defineMeta } from '@storybook/sveltekit';

          const PARAMS = { sveltekit_experimental: { state: { page: { status: 1 } } } };

          const { Story } = defineMeta({});
        </script>

        <Story name="Shared" parameters={PARAMS} />
        <Story
          name="Reads"
          play={({ parameters: { sveltekit_experimental } }) => sveltekit_experimental}
        />
      `;
      const { failures, svelte } = await migrate({ svelte: story });

      expect(svelte).toBe(story);
      expect(failures).toMatchInlineSnapshot(`
        [
          "Could not migrate \`sveltekit_experimental\`, so this file is unchanged. line 4: \`sveltekit_experimental\` is not in the \`parameters\` object literal of a story, the meta or the preview, but in a shared variable or a helper function, so the fix can't tell which stories use it. line 12: Reads \`sveltekit_experimental\` from the parameters, which no longer have it. Assert on the mocks from their modules instead, for example \`expect(goto)\`. Migrate it by hand: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#sveltekit-sveltekit_experimental-parameters-removed",
        ]
      `);
    });

    it('rewrites every key of the table in <script context="module"> files', async () => {
      const { failures, svelte } = await migrate({
        svelte: dedent`
          <script context="module">
            import { defineMeta } from '@storybook/sveltekit';
            import { fn } from 'storybook/test';

            const onLink = fn();

            const { Story } = defineMeta({});
          </script>

          <Story
            name="All"
            parameters={{
              sveltekit_experimental: {
                state: {
                  navigating: { type: 'link' },
                  updated: { current: true },
                },
                navigation: {
                  pushState: (url, state) => console.log(url, state),
                  replaceState: onLink,
                  afterNavigate: { type: 'link' },
                },
                hrefs: {
                  '/a': onLink,
                  '/b': true,
                  'c$': { callback: (to) => console.log(to), asRegex: true },
                },
                forms: { enhance: () => console.log('submitted') },
              },
            }}
          />
        `,
      });

      expect(failures).toEqual([]);
      expect(svelte).toMatchInlineSnapshot(`
        "<script context="module">
          import { defineMeta } from '@storybook/sveltekit';
          import { fn, mocked } from 'storybook/test';
          import { navigating, updated } from '$app/state';
          import { pushState, replaceState } from '$app/navigation';
          import { link, setAfterNavigate } from '@storybook/sveltekit/navigation.mock';
          import { formAction } from '@storybook/sveltekit/forms.mock';

          const onLink = fn();

          const { Story } = defineMeta({});
        </script>

        <Story
          name="All"
          beforeEach={() => {
            navigating.type = 'link';
            Object.assign(updated, { current: true });
            mocked(pushState).mockImplementation(async (url, state) => {
              console.log(url, state);
            });
            mocked(replaceState).mockImplementation(async (...args) => {
              onLink(...args);
            });
            setAfterNavigate({ type: 'link' });
            link.mockImplementation((href, event) => {
              if (href === '/a') onLink(href, event);
              if (new RegExp('c$').test(href)) console.log(href);
            });
            formAction.mockImplementation(async (submission) => {
              console.log('submitted');
              return { type: 'success', status: 200 };
            });
          }}
        />"
      `);
    });

    it('migrates the stores of Storybook 10 to $app/state, and keeps state when both are set', async () => {
      const { svelte } = await migrate({
        svelte: dedent`
          <script module>
            import { defineMeta } from '@storybook/sveltekit';

            const { Story } = defineMeta({
              tags: ['autodocs'],
              parameters: {
                sveltekit_experimental: { stores: { page: { status: 1 }, updated: true } },
              },
            });
          </script>

          <Story name="Default" />
          <Story
            name="Both"
            parameters={{ sveltekit_experimental: { stores: { page: { status: 2 } }, state: { page: { status: 3 } } } }}
          />
        `,
      });

      expect(svelte).toMatchInlineSnapshot(`
        "<script module>
          import { defineMeta } from '@storybook/sveltekit';
          import { page, updated } from '$app/state';

          const { Story } = defineMeta({
            tags: ['autodocs'],
            parameters: {
              docs: { story: { inline: false } },
            },
            beforeEach() {
              page.status = 1;
              Object.assign(updated, { current: true });
            },
          });
        </script>

        <Story name="Default" />
        <Story
          name="Both"
          beforeEach={() => {
            page.status = 3;
          }}
        />"
      `);
    });

    it('reports a spread <Story>, a sveltekit_experimental in the markup, and hrefs on the meta and a story', async () => {
      const story = dedent`
        <script module>
          import { defineMeta } from '@storybook/sveltekit';

          const { Story } = defineMeta({
            parameters: { sveltekit_experimental: { hrefs: { '/': () => console.log('/') } } },
          });
        </script>

        <Story name="Spread" {...props} parameters={{ sveltekit_experimental: { state: { page: { status: 1 } } } }} />
        <Story name="Hrefs" parameters={{ sveltekit_experimental: { hrefs: { '/a': () => console.log('/a') } } }} />
        <Other parameters={{ sveltekit_experimental: {} }} />
      `;
      const { failures, svelte } = await migrate({ svelte: story });

      expect(svelte).toBe(story);
      expect(failures).toMatchInlineSnapshot(`
        [
          "Could not migrate \`sveltekit_experimental\`, so this file is unchanged. line 9: The \`<Story>\` spreads attributes, which can set \`beforeEach\` and \`parameters\` too. line 10: \`hrefs\` is also set on a level around this one. The old parameters merged both objects, and \`link.mockImplementation()\` replaces the earlier one. line 11: \`sveltekit_experimental\` is outside the \`<script module>\` and the \`<Story>\` attributes, so the fix can't tell which stories use it. Migrate it by hand: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#sveltekit-sveltekit_experimental-parameters-removed",
        ]
      `);
    });

    it('reports a Svelte CSF file when the project has no svelte/compiler to read it with', async () => {
      const outside = resolve('/', 'no-svelte-here', 'Page.stories.svelte');
      const story = '<Story parameters={{ sveltekit_experimental: {} }} />';
      vol.fromJSON({ [previewConfigPath]: '', [outside]: story });
      const storiesPaths = [outside];
      const result = await checkFix(sveltekitMockingBeforeEach, { ...options, storiesPaths });
      const failures = await runFix(sveltekitMockingBeforeEach, {
        ...options,
        storiesPaths,
        result: result!,
      });

      expect(failures.map(({ message }) => message.split('\n')[0])).toMatchInlineSnapshot(`
        [
          "Could not find \`svelte/compiler\` from this file, which the fix needs to read Svelte CSF: Cannot find module 'svelte/compiler'",
        ]
      `);
    });

    it('reports a legacy Svelte CSF file, which has no <script module>', async () => {
      const story = dedent`
        <script>
          import { Meta, Story } from '@storybook/addon-svelte-csf';
        </script>

        <Meta title="Page" />
        <Story name="A" parameters={{ sveltekit_experimental: { state: { page: { status: 1 } } } }} />
      `;
      const { failures, svelte } = await migrate({ svelte: story });

      expect(svelte).toBe(story);
      expect(failures[0]).toContain(
        "line 6: `sveltekit_experimental` is outside the `<script module>` and the `<Story>` attributes, so the fix can't tell which stories use it."
      );
    });

    it('reports a meta with a docs page that renders its stories inline', async () => {
      const csf = dedent`
        export default { tags: ['autodocs'], parameters: { docs: { story: { inline: true } } } };
        export const A = { parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } } };
      `;
      const svelte = dedent`
        <script module>
          import { defineMeta } from '@storybook/sveltekit';
          const { Story } = defineMeta({
            tags: ['autodocs'],
            parameters: { docs: { story: { inline: true } } },
          });
        </script>

        <Story name="A" parameters={{ sveltekit_experimental: { state: { page: { status: 1 } } } }} />
      `;
      const result = await migrate({ csf, svelte });

      expect(result.csf).toBe(csf);
      expect(result.svelte).toBe(svelte);
      expect(result.failures.map((failure) => failure.match(/line \d+/)?.[0])).toEqual([
        'line 1',
        'line 5',
      ]);
      expect(result.failures[0]).toContain(
        'the meta sets `parameters.docs.story.inline` to a value other than `false`'
      );
    });

    it('keeps a {beforeEach} shorthand attribute, and ignores markup comments', async () => {
      const { failures, svelte } = await migrate({
        svelte: dedent`
          <script module>
            import { defineMeta } from '@storybook/sveltekit';

            const beforeEach = () => console.log('shared');

            const { Story } = defineMeta({});
          </script>

          <!-- These stories used sveltekit_experimental before Storybook 11 -->
          <Story name="A" {beforeEach} parameters={{ sveltekit_experimental: { state: { page: { status: 1 } } } }} />
        `,
      });

      expect(failures).toEqual([]);
      expect(svelte).toMatchInlineSnapshot(`
        "<script module>
          import { defineMeta } from '@storybook/sveltekit';
          import { page } from '$app/state';

          const beforeEach = () => console.log('shared');

          const { Story } = defineMeta({});
        </script>

        <!-- These stories used sveltekit_experimental before Storybook 11 -->
        <Story name="A" beforeEach={[() => {
          page.status = 1;
        }, ...[beforeEach].flat()]} />"
      `);
    });

    it('follows a Story destructured later from the meta, and leaves a module import that the instance script shadows', async () => {
      const { svelte } = await migrate({
        svelte: dedent`
          <script module>
            import preview from '#.storybook/preview';
            import { page } from '$app/state';

            const meta = preview.meta({ tags: ['autodocs'] });
            const { Story: S } = meta;
          </script>

          <script>
            const page = { status: 0 };
          </script>

          <S name="A" parameters={{ sveltekit_experimental: { state: { page: { status: 1 } } } }} />
          <S name="B" />
        `,
      });

      expect(svelte).toContain("import { page, page as _page } from '$app/state';");
      expect(svelte).toContain('_page.status = 1;');
      expect(svelte).toContain('docs: { story: { inline: false } }');
    });

    it('reports an enhance callback from the instance script that reads the submit event', async () => {
      const { failures } = await migrate({
        svelte: dedent`
          <script module>
            import { defineMeta } from '@storybook/sveltekit';

            const { Story } = defineMeta({});
          </script>

          <script>
            function onSubmit(event) {
              event.preventDefault();
            }
          </script>

          <Story name="A" parameters={{ sveltekit_experimental: { forms: { enhance: onSubmit } } }} />
        `,
      });

      expect(failures[0]).toContain('`forms.enhance` reads the submit event');
    });

    it('merges a <Story extend> with the parameters of the story it extends', async () => {
      const { svelte } = await migrate({
        svelte: dedent`
          <script module>
            import { defineMeta } from '@storybook/sveltekit';

            const { Story } = defineMeta({});
          </script>

          <Story name="Child" extend="Base" parameters={{ sveltekit_experimental: { state: { page: { data: { flag: true } } } } }} />
          <Story name="Base" parameters={{ sveltekit_experimental: { state: { page: { data: { user: 'Ada' } } } } }} />
        `,
      });

      expect(svelte).toContain('page.data = { ...page.data, flag: true };');
      expect(svelte).toContain("page.data = { user: 'Ada' };");
    });

    it('merges only the stories that extend another one', async () => {
      const { failures, svelte } = await migrate({
        svelte: dedent`
          <script module>
            import { defineMeta } from '@storybook/sveltekit';

            const { Story } = defineMeta({});
          </script>

          <Story name="Base" parameters={{ sveltekit_experimental: { hrefs: { '/': () => console.log('base') } } }} />
          <Story exportName="A" parameters={{ sveltekit_experimental: { hrefs: { '/a': () => console.log('a') } } }} />
          <Story exportName="B" extend="Base" />
        `,
      });

      expect(failures).toEqual([]);
      expect(svelte).toContain("if (href === '/a') console.log('a');");
    });

    it('reads story names written as string expressions', async () => {
      const { svelte } = await migrate({
        svelte: dedent`
          <script module>
            import { defineMeta } from '@storybook/sveltekit';

            const { Story } = defineMeta({});
          </script>

          <Story name={'Base'} parameters={{ sveltekit_experimental: { state: { page: { data: { user: 'Ada' } } } } }} />
          <Story name="Child" extend={'Base'} parameters={{ sveltekit_experimental: { state: { page: { data: { flag: true } } } } }} />
        `,
      });

      expect(svelte).toContain('page.data = { ...page.data, flag: true };');
    });

    it('renders in iframes the stories of a file whose stories have the autodocs tag', async () => {
      const csf = await migrate({
        csf: dedent`
          export default {};
          export const A = {
            tags: ['autodocs'],
            parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } },
          };
        `,
      });
      const svelte = await migrate({
        svelte: dedent`
          <script module>
            import { defineMeta } from '@storybook/sveltekit';

            const { Story } = defineMeta({});
          </script>

          <Story name="A" tags={['autodocs']} parameters={{ sveltekit_experimental: { state: { page: { status: 1 } } } }} />
        `,
      });

      expect(csf.csf).toContain('docs: { story: { inline: false } }');
      expect(svelte.svelte).toContain('docs: { story: { inline: false } }');
    });

    it('changes nothing on a second run', async () => {
      const first = await migrate({
        svelte: dedent`
          <script module>
            import { defineMeta } from '@storybook/sveltekit';

            const { Story } = defineMeta({});
          </script>

          <Story name="A" parameters={{ sveltekit_experimental: { state: { page: { status: 1 } } } }} />
        `,
      });
      const second = await migrate({ svelte: first.svelte });

      expect(second.applies).toBe(false);
      expect(second.svelte).toBe(first.svelte);
    });
  });

  describe('invariants', () => {
    it('keeps reporting a story on a run after the one that migrated the preview it merges with', async () => {
      const preview = dedent`
        export default {
          parameters: { sveltekit_experimental: { hrefs: { '/login': (to) => console.log(to) } } },
        };
      `;
      const story = dedent`
        export default {};
        export const A = { parameters: { sveltekit_experimental: { hrefs: { '/a': () => {} } } } };
      `;
      const first = await migrate({ preview, csf: story });
      expect(first.failures).toHaveLength(1);
      expect(first.preview).toContain('link.mockImplementation');

      vol.reset();
      const second = await migrate({ preview: first.preview, csf: story });

      expect(second.csf).toBe(story);
      expect(second.failures).toHaveLength(1);
      expect(second.failures[0]).toContain('`hrefs` is also set on a level around this one');
    });

    it('reports a story whose meta was migrated by hand and sets what the story merges with', async () => {
      const story = dedent`
        import { link } from '@storybook/sveltekit/navigation.mock';
        export default { beforeEach() { link.mockImplementation(() => {}); } };
        export const A = { parameters: { sveltekit_experimental: { hrefs: { '/a': () => {} } } } };
      `;
      const { failures, csf } = await migrate({ csf: story });

      expect(csf).toBe(story);
      expect(failures[0]).toContain('`hrefs` is also set on a level around this one');
    });

    it('reports page values that the old parameters merged deeper than the spread, or from a variable', async () => {
      const nested = dedent`
        export default {
          parameters: { sveltekit_experimental: { state: { page: { data: { user: { name: 'Ada', role: 'admin' } } } } } },
        };
        export const A = {
          parameters: { sveltekit_experimental: { state: { page: { data: { user: { name: 'Bob' } } } } } },
        };
      `;
      const variable = dedent`
        const shared = { user: 'Ada' };
        export default { parameters: { sveltekit_experimental: { state: { page: { data: shared } } } } };
        export const A = { parameters: { sveltekit_experimental: { state: { page: { data: { extra: 1 } } } } } };
      `;

      const first = await migrate({ csf: nested });
      vol.reset();
      const second = await migrate({ csf: variable });

      expect(first.csf).toBe(nested);
      expect(first.failures[0]).toContain(
        '`state.page.data.user` is also set on a level around this one'
      );
      expect(second.csf).toBe(variable);
      expect(second.failures[0]).toContain(
        '`state.page.data` is also set on a level around this one'
      );
    });

    it('reports a story that spreads a migrated story and replaces its parameters', async () => {
      const story = dedent`
        export default {};
        export const LoggedIn = {
          parameters: { sveltekit_experimental: { state: { page: { data: { user: 'Ada' } } } } },
        };
        export const Fullscreen = { ...LoggedIn, parameters: { layout: 'fullscreen' } };
      `;
      const { failures, csf } = await migrate({ csf: story });

      expect(csf).toBe(story);
      expect(failures[0]).toContain('but sets its own `parameters`');
    });

    it('reports a preview whose beforeEach comes from a spread or from another module', async () => {
      const parameters = `{ sveltekit_experimental: { state: { page: { status: 1 } } } }`;
      const previews = [
        `import base from '../../shared/preview';\nexport default { ...base, parameters: ${parameters} };\n`,
        `export { beforeEach } from './helpers';\nexport const parameters = ${parameters};\n`,
        `export * from '@company/storybook-config/preview';\nexport const parameters = ${parameters};\n`,
      ];
      for (const preview of previews) {
        vol.reset();
        const result = await migrate({ preview });
        expect(result.preview).toBe(preview);
        expect(result.failures).toHaveLength(1);
      }
    });

    it('drops a navigation value that is the mock that the file imports already', async () => {
      const { failures, csf } = await migrate({
        csf: dedent`
          import { goto } from '$app/navigation';
          export default {};
          export const A = { parameters: { sveltekit_experimental: { navigation: { goto } } } };
        `,
      });

      expect(failures).toEqual([]);
      expect(csf).toMatchInlineSnapshot(`
        "import { goto } from '$app/navigation';
        export default {};
        export const A = {};"
      `);
    });

    it('keeps a const goto = fn() spy that other code calls when a level implements goto', async () => {
      const { csf } = await migrate({
        csf: dedent`
          import { fn } from 'storybook/test';
          const goto = fn();
          export default {
            parameters: { sveltekit_experimental: { navigation: { goto: (url) => console.log(url) } } },
          };
          export const A = { parameters: { sveltekit_experimental: { navigation: { goto } } } };
          export const B = { args: { onClick: goto } };
        `,
      });

      expect(csf).toMatchInlineSnapshot(`
        "import { fn, mocked } from 'storybook/test';
        import { goto as _goto } from '$app/navigation';
        const goto = fn();
        export default {
          beforeEach() {
            mocked(_goto).mockImplementation(async (url) => {
              console.log(url);
            });
          },
        };
        export const A = { beforeEach() {
          mocked(_goto).mockImplementation(async (...args) => {
            goto(...args);
          });
        } };
        export const B = { args: { onClick: goto } };"
      `);
    });

    it('reports forms.enhance given a module function that reads the submit event', async () => {
      const story = dedent`
        const onSubmit = (event) => event.preventDefault();
        export default {};
        export const A = { parameters: { sveltekit_experimental: { forms: { enhance: onSubmit } } } };
      `;
      const { failures, csf } = await migrate({ csf: story });

      expect(csf).toBe(story);
      expect(failures[0]).toContain('`forms.enhance` reads the submit event');
    });

    it('calls the typed callbacks of a TypeScript file through a cast', async () => {
      const { csf } = await migrate({
        csf: dedent`
          const onLink = (to: string) => console.log(to);
          export default {};
          export const A = {
            parameters: {
              sveltekit_experimental: {
                navigation: { goto: (url: string) => console.log(url) },
                hrefs: { '/a': onLink },
              },
            },
          };
        `,
      });

      expect(csf).toMatchInlineSnapshot(`
        "import { goto } from '$app/navigation';
        import { link } from '@storybook/sveltekit/navigation.mock';
        import { mocked } from 'storybook/test';

        const onLink = (to: string) => console.log(to);
        export default {};
        export const A = {
          beforeEach() {
            mocked(goto).mockImplementation((async (url: string) => {
              console.log(url);
            }) as typeof goto);
            link.mockImplementation((href, event) => {
              if (href === '/a') onLink(href);
            });
          },
        };"
      `);
    });

    it('names the formAction parameter so that it does not capture a name the enhance callback reads', async () => {
      const { csf } = await migrate({
        csf: dedent`
          const submission = 'fixture';
          export default {};
          export const A = {
            parameters: { sveltekit_experimental: { forms: { enhance: () => console.log(submission) } } },
          };
        `,
      });

      expect(csf).toContain('formAction.mockImplementation(async (_submission) => {');
      expect(csf).toContain('console.log(submission);');
    });

    it('keeps a spy that an aliased import of the same mock would leave without a binding', async () => {
      const { csf } = await migrate({
        csf: dedent`
          import { goto as navigate } from '$app/navigation';
          import { expect, fn } from 'storybook/test';

          const goto = fn();
          export default {};
          export const A = {
            parameters: { sveltekit_experimental: { navigation: { goto } } },
            play: async () => expect(goto).toHaveBeenCalled(),
          };
        `,
      });

      expect(csf).toContain('const goto = fn();');
      expect(csf).toContain('mocked(navigate).mockImplementation(async (...args) => {');
    });

    it('removes a declaration whose spies all give way to the imported mocks', async () => {
      const { csf } = await migrate({
        csf: dedent`
          import { fn } from 'storybook/test';

          const goto = fn(),
            invalidate = fn();
          export default {};
          export const A = {
            parameters: { sveltekit_experimental: { navigation: { goto, invalidate } } },
          };
        `,
      });

      expect(csf).toMatchInlineSnapshot(`
        "import { goto, invalidate } from '$app/navigation';

        export default {};
        export const A = {};"
      `);
    });

    it('names generated parameters so that they capture nothing the callbacks read', async () => {
      const { csf } = await migrate({
        csf: dedent`
          const args = ['/fallback'];
          export default {};
          export const A = {
            parameters: { sveltekit_experimental: { navigation: { goto: makeGoto(args) } } },
          };
        `,
      });

      expect(csf).toContain('async (..._args) => {');
      expect(csf).toContain('makeGoto(args)(..._args);');
    });

    it('wraps an expression body that would start a block as a statement', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default {};
          export const A = {
            parameters: {
              sveltekit_experimental: {
                navigation: { goto: () => ({ a: record(), b: notify() }) },
                forms: { enhance: () => ({ a: record() }) },
              },
            },
          };
        `,
      });

      expect(csf).toContain('({ a: record(), b: notify() });');
      expect(csf).toContain('({ a: record() });');
    });

    it('skips an undefined value, which kept the value of the meta in the old parameters', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default {
            parameters: { sveltekit_experimental: { navigation: { goto: (url) => console.log(url) } } },
          };
          export const A = {
            parameters: { sveltekit_experimental: { navigation: { goto: undefined } } },
          };
        `,
      });

      expect(csf).not.toContain('async () => {}');
    });

    it('renders in iframes a meta whose docs story or parameters come from a variable', async () => {
      const story = (meta: string) => dedent`
        export default { tags: ['autodocs'], ${meta} };
        export const A = { parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } } };
        export const B = {};
      `;
      const sharedStory = await migrate({
        csf: story(`parameters: { docs: { story: sharedStory } }`),
      });
      const sharedParameters = await migrate({ csf: story(`parameters: shared`) });

      expect(sharedStory.csf).toContain('story: { ...sharedStory, inline: false }');
      expect(sharedParameters.csf).toContain(
        'parameters: { ...shared, docs: { ...(shared as { docs?: object } | undefined)?.docs, story: { ...(shared as { docs?: { story?: object } } | undefined)?.docs?.story, inline: false } } }'
      );
    });

    it('merges a story of Base.extend() with the parameters of Base', async () => {
      const { csf } = await migrate({
        csf: dedent`
          import preview from '#.storybook/preview';

          const meta = preview.meta({});
          export const Base = meta.story({
            parameters: { sveltekit_experimental: { state: { page: { data: { user: 'Ada' } } } } },
          });
          export const Child = Base.extend({
            parameters: { sveltekit_experimental: { state: { page: { data: { flag: true } } } } },
          });
        `,
      });

      expect(csf).toContain('page.data = { ...page.data, flag: true };');
    });

    it('keeps the fn import when a fn() moves into the new beforeEach', async () => {
      const { csf } = await migrate({
        csf: dedent`
          import { fn } from 'storybook/test';

          export default {};
          export const A = {
            parameters: { sveltekit_experimental: { state: { page: { data: { onClick: fn() } } } } },
          };
        `,
      });

      expect(csf).toContain("import { fn } from 'storybook/test';");
      expect(csf).toContain('page.data = { onClick: fn() };');
    });

    it('replaces a beforeEach that is undefined', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default {};
          export const A = {
            beforeEach: undefined,
            parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } },
          };
        `,
      });

      expect(csf).toMatchInlineSnapshot(`
        "import { page } from "$app/state";

        export default {};
        export const A = {
          beforeEach() {
            page.status = 1;
          },
        };"
      `);
    });

    it('calls a module callback with as many arguments as it declares', async () => {
      const { csf } = await migrate({
        csf: dedent`
          const onGoto = () => console.log('go');
          const onInvalidate = (resource) => console.log(resource);
          export default {};
          export const A = {
            parameters: { sveltekit_experimental: { navigation: { goto: onGoto, invalidate: onInvalidate } } },
          };
        `,
      });

      expect(csf).toContain('onGoto();');
      expect(csf).toContain('onInvalidate(args[0]);');
    });

    it('flattens an existing beforeEach that can be an array of hooks', async () => {
      const { csf } = await migrate({
        csf: dedent`
          const hooks = [() => console.log('setup')];
          export default {};
          export const A = {
            beforeEach: hooks,
            parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } },
          };
        `,
      });

      expect(csf).toContain('}, ...[hooks].flat()],');
    });

    it('drops the value of an async expression body, which goto would return', async () => {
      const { csf } = await migrate({
        csf: dedent`
          let count = 0;
          export default {};
          export const A = {
            parameters: { sveltekit_experimental: { navigation: { goto: async () => count++ } } },
          };
        `,
      });

      expect(csf).toContain(
        'mocked(goto).mockImplementation(async () => {\n      count++;\n    });'
      );
    });

    it('calls an hrefs arrow that writes to its parameter instead of inlining it', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default {};
          export const A = {
            parameters: {
              sveltekit_experimental: {
                hrefs: { '/a': (to) => { to = '/b'; notify(to); }, '/b': () => notify('b') },
              },
            },
          };
        `,
      });

      expect(csf).toContain("if (href === '/a') ((to) => {");
    });

    it('reports a story whose beforeEach an assignment replaces', async () => {
      const { failures } = await migrate({
        csf: dedent`
          export default {};
          export const A = {
            parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } },
          };
          A.beforeEach = () => {};
        `,
      });

      expect(failures[0]).toContain('Assigns `A.beforeEach`');
    });

    it('counts a story exported under a second name for the docs page', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default { tags: ['autodocs'] };
          const A = { parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } } };
          export { A, A as B };
        `,
      });

      expect(csf).toContain('docs: { story: { inline: false } }');
    });

    it('casts a typed method of a TypeScript file like a typed arrow', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default {};
          export const A = {
            parameters: {
              sveltekit_experimental: { navigation: { goto(url: string) { console.log(url); } } },
            },
          };
        `,
      });

      expect(csf).toContain('}) as typeof goto);');
    });

    it('reports a value that awaits at module level', async () => {
      const { failures } = await migrate({
        csf: dedent`
          export default {};
          export const A = {
            parameters: { sveltekit_experimental: { state: { page: { data: await loadFixture() } } } },
          };
        `,
      });

      expect(failures[0]).toContain('Awaits a value');
    });

    it('renders in iframes the stories of a project whose preview tags it cannot read', async () => {
      const { csf } = await migrate({
        preview: `const baseTags = ['autodocs']; export default { tags: [...baseTags] };`,
        csf: dedent`
          export default {};
          export const A = { parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } } };
        `,
      });

      expect(csf).toContain('docs: { story: { inline: false } }');
    });

    it('ends the new statements with a semicolon where the next one would continue them', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default {}
          export const A = {
            beforeEach() {
              ;(() => setup())()
            },
            parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } },
          }
          export const B = {
            beforeEach() {
              (() => setup())()
            },
            parameters: { sveltekit_experimental: { state: { page: { status: 2 } } } },
          }
        `,
      });

      expect(csf).toContain('page.status = 1\n');
      expect(csf).toContain('page.status = 2;\n');
    });

    it('expands a shorthand docs parameter that it spreads', async () => {
      const { csf } = await migrate({
        csf: dedent`
          const docs = { description: { component: 'Page' } };
          export default { tags: ['autodocs'], parameters: { docs } };
          export const A = { parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } } };
        `,
      });

      expect(csf).toContain(
        'parameters: { docs: { ...docs, story: { ...(docs as { story?: object } | undefined)?.story, inline: false } } }'
      );
    });

    it('spreads the meta value into a story object inside a type assertion', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default {
            parameters: { sveltekit_experimental: { state: { page: { data: { user: 'Ada' } } } } },
          };
          export const A = {
            parameters: {
              sveltekit_experimental: { state: { page: { data: <Record<string, unknown>>{ flag: true } } } },
            },
          };
        `,
      });

      expect(csf).toContain('page.data = <Record<string, unknown>>{ ...page.data, flag: true };');
    });

    it('calls an hrefs arrow that returns an object instead of inlining it as a block', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default {};
          export const A = {
            parameters: { sveltekit_experimental: { hrefs: { '/a': (to) => ({ a: log(to), b: log(to) }) } } },
          };
        `,
      });

      expect(csf).toContain(`if (href === '/a') ((to) => ({ a: log(to), b: log(to) }))(href);`);
    });

    it('calls a typed hrefs arrow instead of inlining it, so its parameter types stay', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default {};
          export const A = {
            parameters: {
              sveltekit_experimental: {
                hrefs: { '/a': (_to: string, e: any) => console.log(e.target.dataset.id) },
              },
            },
          };
        `,
      });

      expect(csf).toContain(
        `if (href === '/a') ((_to: string, e: any) => console.log(e.target.dataset.id))(href, event);`
      );
    });

    it('passes an hrefs method only the parameters it declares, unless it reads `arguments`', async () => {
      const { csf } = await migrate({
        csf: dedent`
          export default {};
          export const A = {
            parameters: {
              sveltekit_experimental: {
                hrefs: {
                  '/a'() { return notify(); },
                  '/b': { callback(to) { return notify(to); } },
                  '/c'() { return notify(arguments[1]); },
                },
              },
            },
          };
        `,
      });

      expect(csf).toContain(`if (href === '/a') (function () { return notify(); })();`);
      expect(csf).toContain(`if (href === '/b') (function (to) { return notify(to); })(href);`);
      expect(csf).toContain(
        `if (href === '/c') (function () { return notify(arguments[1]); })(href, event);`
      );
    });

    it('names the `inline` problem together with the other problems of the file', async () => {
      const csf = dedent`
        export default { tags: ['autodocs'], parameters: { docs: { story: { inline: true } } } };
        export const A = {
          parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } },
          play: ({ parameters }) => parameters.sveltekit_experimental,
        };
      `;
      const svelte = dedent`
        <script module>
          import { defineMeta } from '@storybook/sveltekit';

          const { Story } = defineMeta({ tags: ['autodocs'], parameters: { docs: { story: { inline: true } } } });
        </script>

        <Story
          name="A"
          parameters={{ sveltekit_experimental: { state: { page: { status: 1 } } } }}
          play={({ parameters }) => parameters.sveltekit_experimental}
        />
      `;
      const result = await migrate({ csf, svelte });

      expect(result.csf).toBe(csf);
      expect(result.svelte).toBe(svelte);
      expect(result.failures).toHaveLength(2);
      for (const [failure, lines] of [
        [result.failures[0], ['line 1: The file has a docs page', 'line 4: Reads']],
        [result.failures[1], ['line 4: The file has a docs page', 'line 10: Reads']],
      ] as const) {
        lines.forEach((line) => expect(failure).toContain(line));
      }
    });

    it('keeps the docs that a spread in the parameters or in `docs` sets, when it adds `inline: false`', async () => {
      const { csf, svelte } = await migrate({
        csf: dedent`
          import { shared } from './shared';

          export default { tags: ['autodocs'], parameters: { ...shared, sveltekit_experimental: { state: { page: { status: 1 } } } } };
          export const A = {};
        `,
        svelte: dedent`
          <script module>
            import { defineMeta } from '@storybook/sveltekit';
            import { sharedDocs, sharedParameters } from './shared';

            const { Story } = defineMeta({ tags: ['autodocs'], parameters: { ...sharedParameters, docs: { ...sharedDocs } } });
          </script>

          <Story name="A" parameters={{ sveltekit_experimental: { state: { page: { status: 1 } } } }} />
        `,
      });

      expect(csf).toContain(
        'parameters: { ...shared, docs: { ...(shared as { docs?: object } | undefined)?.docs, story: { ...(shared as { docs?: { story?: object } } | undefined)?.docs?.story, inline: false } } }'
      );
      expect(svelte).toContain(
        'parameters: { ...sharedParameters, docs: { ...sharedDocs, story: { ...sharedDocs?.story, inline: false } } }'
      );
    });

    it('renders in iframes the stories that an MDX docs page imports through `$lib`', async () => {
      const storyPath = resolve(project, 'src/lib/Page.stories.ts');
      const mdxPath = resolve(project, 'src/docs/Page.mdx');
      vol.fromJSON({
        [previewConfigPath]: '',
        [storyPath]: dedent`
          export default {};
          export const A = { parameters: { sveltekit_experimental: { state: { page: { status: 1 } } } } };
        `,
        [mdxPath]:
          "import { Meta, Stories } from '@storybook/addon-docs/blocks';\nimport * as PageStories from '$lib/Page.stories';\n\n<Meta of={PageStories} />\n\n<Stories />",
      });
      const storiesPaths = [storyPath, mdxPath];
      const result = await checkFix(sveltekitMockingBeforeEach, { ...options, storiesPaths });
      await runFix(sveltekitMockingBeforeEach, { ...options, storiesPaths, result: result! });

      expect(fs.readFileSync(storyPath, 'utf8')).toContain(
        'parameters: { docs: { story: { inline: false } } }'
      );
    });
  });
});
