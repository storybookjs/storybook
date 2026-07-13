import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type { ComponentsManifest, Manifests, Presets, StoryIndex } from 'storybook/internal/types';

import * as v from 'valibot';
import { vol } from 'memfs';
import type { Polka } from 'polka';

import { defineService } from '../../../shared/open-service/index.ts';
import { clearRegistry, registerService } from '../../../shared/open-service/server.ts';
import { registerTestModuleGraphService } from '../../../shared/open-service/services/module-graph/module-graph.test-helpers.ts';
import { registerDocgenService } from '../../../shared/open-service/services/docgen/server.ts';
import { registerStoryDocsService } from '../../../shared/open-service/services/story-docs/server.ts';
import type { DocgenProvider } from '../../../shared/open-service/services/docgen/types.ts';
import type { StoryDocsProvider } from '../../../shared/open-service/services/story-docs/types.ts';
import { Tag } from '../../../shared/constants/tags.ts';
import { registerManifests, writeManifests } from './manifests.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger');

describe('manifests', () => {
  let mockGetIndex: ReturnType<typeof vi.fn<() => Promise<StoryIndex>>>;
  let mockGenerator: { getIndex: () => Promise<StoryIndex> };
  let mockManifests: Manifests | null;

  type RouteHandler = (req: { params?: { name?: string } }, res: MockResponse) => Promise<void>;
  type MockResponse = {
    setHeader: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    statusCode?: number | undefined;
  };

  const createResponse = (): MockResponse => ({
    setHeader: vi.fn(),
    end: vi.fn(),
    statusCode: undefined,
  });

  const registerTestMdxService = (components: Record<string, unknown>) => {
    const testMdxServiceDef = defineService({
      id: 'addon-docs/mdx',
      initialState: { components },
      queries: {
        mdxForAllComponents: {
          input: v.void(),
          output: v.record(v.string(), v.unknown()),
          handler: (_input, ctx) => ctx.self.state.components,
          load: async () => {},
        },
      },
      commands: {},
    });

    return registerService(testMdxServiceDef);
  };

  const setupMockPresets = (options?: {
    componentsManifest?: boolean;
    experimentalDocgenServer?: boolean;
  }) => {
    mockGetIndex = vi.fn<() => Promise<StoryIndex>>().mockResolvedValue({
      entries: {},
    } as StoryIndex);
    mockGenerator = { getIndex: mockGetIndex };
    mockManifests = {};

    return {
      apply: vi.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'storyIndexGenerator':
            return Promise.resolve(mockGenerator);
          case 'experimental_manifests':
            return Promise.resolve(mockManifests ?? undefined);
          case 'features':
            return Promise.resolve({
              componentsManifest: options?.componentsManifest ?? true,
              experimentalDocgenServer: options?.experimentalDocgenServer ?? false,
            });
          default:
            return Promise.resolve(undefined);
        }
      }),
    } satisfies Presets;
  };

  beforeEach(async () => {
    vol.reset();
    vi.clearAllMocks();

    const memfs = await vi.importActual<typeof import('memfs')>('memfs');

    vi.mocked(mkdir).mockImplementation(
      memfs.fs.promises.mkdir as unknown as typeof import('node:fs/promises').mkdir
    );
    vi.mocked(writeFile).mockImplementation(
      memfs.fs.promises.writeFile as unknown as typeof import('node:fs/promises').writeFile
    );
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
    );
  });

  afterEach(() => {
    clearRegistry();
  });

  describe('writeManifests', () => {
    let mockPresets: Presets;

    beforeEach(() => {
      mockPresets = setupMockPresets();
    });

    it('should do nothing when manifests are empty', async () => {
      mockManifests = {};

      await writeManifests('/output', mockPresets);

      expect(vol.toJSON()).toEqual({});
    });

    it('should create manifests directory and write JSON files', async () => {
      mockManifests = {
        custom: { data: 'value' },
        another: { items: [1, 2, 3] },
      };

      await writeManifests('/output', mockPresets);

      const files = vol.toJSON();
      expect(files['/output/manifests/custom.json']).toBe(
        JSON.stringify({ data: 'value' }, null, 2)
      );
      expect(files['/output/manifests/another.json']).toBe(
        JSON.stringify({ items: [1, 2, 3] }, null, 2)
      );
    });

    it('writes legacy inline components.json with array-shaped stories when experimentalDocgenServer is disabled', async () => {
      mockManifests = {
        components: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: './Button.stories.tsx',
              stories: [{ id: 'button--primary', name: 'Primary', snippet: '<Button />' }],
              jsDocTags: {},
            },
          },
        },
      };

      await writeManifests('/output', mockPresets);

      const files = vol.toJSON();
      const componentsJson = JSON.parse(files['/output/manifests/components.json'] as string);
      expect(componentsJson.v).toBe(0);
      expect(componentsJson.components.button.stories).toEqual([
        { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
      ]);
    });

    it('should write HTML file when components manifest exists', async () => {
      const componentsManifest: ComponentsManifest = {
        v: 0,
        components: {
          Button: {
            id: 'button',
            name: 'Button',
            path: './Button.tsx',
            stories: [],
            jsDocTags: {},
          },
        },
      };
      mockManifests = {
        components: componentsManifest,
      };

      await writeManifests('/output', mockPresets);

      const files = vol.toJSON();
      expect(files['/output/manifests/components.html']).toBeDefined();
      expect(files['/output/manifests/components.html']).toContain('<!doctype html>');
    });

    it('should render subcomponents in the manifest debugger', async () => {
      mockManifests = {
        components: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: './Button.stories.tsx',
              stories: [],
              jsDocTags: {},
              subcomponents: {
                ButtonIcon: {
                  name: 'ButtonIcon',
                  path: './ButtonIcon.tsx',
                  jsDocTags: {},
                },
              },
            },
          },
        } as ComponentsManifest,
      };

      await writeManifests('/output', mockPresets);

      const files = vol.toJSON();
      expect(files['/output/manifests/components.html']).toContain('ButtonIcon');
      expect(files['/output/manifests/components.html']).toContain('subcomponent');
    });

    it('should write HTML file when docs manifest exists', async () => {
      mockManifests = {
        docs: {
          v: 0,
          docs: {
            'intro--docs': {
              id: 'intro--docs',
              name: 'docs',
              path: './Intro.mdx',
              title: 'Intro',
              content: '# Introduction',
            },
          },
        },
      };

      await writeManifests('/output', mockPresets);

      const files = vol.toJSON();
      expect(files['/output/manifests/components.html']).toBeDefined();
      expect(files['/output/manifests/components.html']).toContain('<!doctype html>');
      expect(files['/output/manifests/components.html']).toContain('Unattached Docs');
    });

    it('should handle errors when presets.apply fails', async () => {
      const error = new Error('Preset application failed');
      vi.mocked(mockPresets.apply).mockRejectedValue(error);

      await writeManifests('/output', mockPresets);

      expect(vi.mocked(logger).error).toHaveBeenCalledWith('Failed to generate manifests');
      expect(vi.mocked(logger).error).toHaveBeenCalledWith(error);
      expect(vol.toJSON()).toEqual({});
    });

    it('should handle non-Error objects in catch block', async () => {
      const errorString = 'Something went wrong';
      vi.mocked(mockPresets.apply).mockRejectedValue(errorString);

      await writeManifests('/output', mockPresets);

      expect(vi.mocked(logger).error).toHaveBeenCalledWith('Failed to generate manifests');
      expect(vi.mocked(logger).error).toHaveBeenCalledWith(errorString);
    });

    it('should filter entries by manifest tag and pass manifestEntries to preset', async () => {
      mockGetIndex.mockResolvedValue({
        v: 5,
        entries: {
          'story-with-manifest': {
            type: 'story',
            subtype: 'story',
            id: 'story-with-manifest',
            name: 'Story',
            title: 'Example',
            importPath: './Example.stories.tsx',
            tags: [Tag.MANIFEST, 'other'],
          },
          'story-without-manifest': {
            type: 'story',
            subtype: 'story',
            id: 'story-without-manifest',
            name: 'Other',
            title: 'Other',
            importPath: './Other.stories.tsx',
            tags: ['other'],
          },
          'docs-entry': {
            type: 'docs',
            id: 'docs',
            name: 'Docs',
            title: 'Docs',
            importPath: './Docs.mdx',
            tags: [Tag.MANIFEST],
            storiesImports: [],
          },
        },
      } as StoryIndex);

      mockManifests = { custom: { data: 'value' } };

      await writeManifests('/output', mockPresets);

      expect(mockPresets.apply).toHaveBeenCalledWith(
        'experimental_manifests',
        undefined,
        expect.objectContaining({
          manifestEntries: expect.arrayContaining([
            expect.objectContaining({ id: 'story-with-manifest' }),
          ]),
        })
      );

      // Get the specific apply call to the experimental_manifests preset
      const manifestsPresetCall = vi
        .mocked(mockPresets.apply)
        .mock.calls.find((call) => call[0] === 'experimental_manifests');

      expect(manifestsPresetCall).toBeDefined();
      const manifestEntriesArg =
        (manifestsPresetCall?.[2] as { manifestEntries?: Array<{ id: string }> })
          ?.manifestEntries ?? [];

      // Should include both story and docs entries with manifest tag
      expect(manifestEntriesArg).toHaveLength(2);
      const entryIds = manifestEntriesArg.map((entry) => entry.id);
      expect(entryIds).toContain('story-with-manifest');
      expect(entryIds).toContain('docs');
      // Should NOT include story without manifest tag
      expect(entryIds).not.toContain('story-without-manifest');
    });

    it('writes ref-based components.json when experimentalDocgenServer is enabled', async () => {
      mockPresets = setupMockPresets({
        componentsManifest: true,
        experimentalDocgenServer: true,
      });
      mockGetIndex.mockResolvedValue({
        v: 5,
        entries: {
          'button--primary': {
            type: 'story',
            subtype: 'story',
            id: 'button--primary',
            name: 'Primary',
            title: 'Button',
            importPath: './button.stories.tsx',
            tags: [Tag.MANIFEST],
          },
        },
      } as StoryIndex);

      mockManifests = {
        components: {
          v: 0,
          components: {},
          meta: { docgen: 'react-component-meta', durationMs: 0 },
        },
        docs: {
          v: 0,
          docs: {
            'intro--docs': {
              id: 'intro--docs',
              name: 'docs',
              path: './Intro.mdx',
              title: 'Intro',
            },
          },
        },
      };

      const docgenProvider = vi.fn<DocgenProvider>(async () => ({
        id: 'button',
        name: 'Button',
        path: './button.stories.tsx',
        description: 'A button',
        jsDocTags: {},
      }));

      const storyDocsProvider = vi.fn<StoryDocsProvider>(async () => ({
        id: 'button',
        name: 'Button',
        path: './button.stories.tsx',
        stories: {
          'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
        },
      }));

      registerTestModuleGraphService();
      registerDocgenService({
        getIndex: () => mockGenerator.getIndex(),
        docgenProvider,
      });
      registerStoryDocsService({
        getIndex: () => mockGenerator.getIndex(),
        storyDocsProvider,
      });

      vol.fromNestedJSON({
        '/output/services/core/docgen/button.json': JSON.stringify({
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: './button.stories.tsx',
              description: 'A button',
              jsDocTags: {},
            },
          },
        }),
        '/output/services/core/story-docs/button.json': JSON.stringify({
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: './button.stories.tsx',
              stories: {
                'button--primary': {
                  id: 'button--primary',
                  name: 'Primary',
                  snippet: '<Button />',
                },
              },
            },
          },
        }),
      });

      await writeManifests('/output', mockPresets);

      const files = vol.toJSON();
      const componentsJson = JSON.parse(files['/output/manifests/components.json'] as string);
      expect(componentsJson.v).toBe(1);
      expect(componentsJson.components.button).toEqual({
        id: 'button',
        name: 'Button',
        description: 'A button',
        docgen: { $ref: '../services/core/docgen/button.json#/components/button' },
        stories: { $ref: '../services/core/story-docs/button.json#/components/button' },
      });
      const storyDocsJson = JSON.parse(
        files['/output/services/core/story-docs/button.json'] as string
      );
      expect(storyDocsJson.components.button.stories).toEqual({
        'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
      });
      expect(files['/output/manifests/docs.json']).toBeDefined();
      expect(files['/output/manifests/components.html']).toContain('Button');
      expect(files['/output/manifests/components.html']).toContain('Unattached Docs');
      // Deep-link contract: every component-id key in components.json must be a stable anchor id on
      // the matching card in components.html, so tooling can open `components.html#<id>`. Asserting
      // against a key read from the emitted JSON guards against any upstream re-keying of the cards.
      const [componentId] = Object.keys(componentsJson.components);
      expect(componentId).toBe('button');
      expect(files['/output/manifests/components.html']).toContain(`id="${componentId}"`);
      // Both components.json and the HTML come from the on-disk snapshot, so the build must not
      // re-extract docgen from the live service.
      expect(docgenProvider).not.toHaveBeenCalled();
    });

    it('writes shallow MDX refs and renders HTML from MDX service snapshots', async () => {
      mockPresets = setupMockPresets({
        componentsManifest: true,
        experimentalDocgenServer: true,
      });
      mockGetIndex.mockResolvedValue({
        v: 5,
        entries: {
          'button--primary': {
            type: 'story',
            subtype: 'story',
            id: 'button--primary',
            name: 'Primary',
            title: 'Button',
            importPath: './button.stories.tsx',
            tags: [Tag.MANIFEST],
          },
          'intro--docs': {
            type: 'docs',
            id: 'intro--docs',
            name: 'Docs',
            title: 'Intro',
            importPath: './intro.mdx',
            tags: [Tag.MANIFEST, Tag.UNATTACHED_MDX],
            storiesImports: [],
          },
        },
      } as StoryIndex);

      mockManifests = {
        components: {
          v: 0,
          components: {
            button: {
              docs: {
                'button--docs': {
                  id: 'button--docs',
                  name: 'Docs',
                  mdx: {
                    $ref: '../services/addon-docs/mdx/button.json#/components/button/docs/button--docs',
                  },
                },
              },
            },
          },
          meta: { docgen: 'react-component-meta', durationMs: 0 },
        } as unknown as ComponentsManifest,
        docs: {
          v: 1,
          docs: {
            'intro--docs': {
              id: 'intro--docs',
              name: 'Docs',
              mdx: {
                $ref: '../services/addon-docs/mdx/intro--docs.json#/components/intro--docs/docs/intro--docs',
              },
            },
          },
        },
      };

      vol.fromNestedJSON({
        '/output/services/core/docgen/button.json': JSON.stringify({
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: './button.stories.tsx',
              jsDocTags: {},
              stories: [],
            },
          },
        }),
        '/output/services/addon-docs/mdx/button.json': JSON.stringify({
          components: {
            button: {
              id: 'button',
              name: 'button',
              docs: {
                'button--docs': {
                  id: 'button--docs',
                  name: 'Docs',
                  path: './button.mdx',
                  title: 'Button Docs',
                  content: '# Attached button docs',
                  summary: 'Attached button summary',
                },
              },
            },
          },
        }),
        '/output/services/addon-docs/mdx/intro--docs.json': JSON.stringify({
          components: {
            'intro--docs': {
              id: 'intro--docs',
              name: 'Docs',
              docs: {
                'intro--docs': {
                  id: 'intro--docs',
                  name: 'Docs',
                  path: './intro.mdx',
                  title: 'Intro',
                  content: '# Unattached intro docs',
                  summary: 'Unattached intro summary',
                },
              },
            },
          },
        }),
      });

      await writeManifests('/output', mockPresets);

      const files = vol.toJSON();
      const componentsJson = JSON.parse(files['/output/manifests/components.json'] as string);
      // The shallow index keeps the `$ref` and layers in the summary read from the MDX snapshot;
      // full content stays behind the ref.
      expect(componentsJson.components.button.docs).toEqual({
        'button--docs': {
          id: 'button--docs',
          name: 'Docs',
          summary: 'Attached button summary',
          mdx: {
            $ref: '../services/addon-docs/mdx/button.json#/components/button/docs/button--docs',
          },
        },
      });
      const docsJson = files['/output/manifests/docs.json'] as string;
      expect(docsJson).toContain('../services/addon-docs/mdx/intro--docs.json');
      expect(docsJson).toContain('Unattached intro summary');
      expect(docsJson).not.toContain('# Unattached intro docs');
      expect(docsJson).toMatch(/^\{\n  "v": 1,/);
      expect(files['/output/manifests/components.json']).toMatch(/^\{\n  "v": 1,/);
      expect(files['/output/manifests/components.html']).toContain('Attached button docs');
      expect(files['/output/manifests/components.html']).toContain('Unattached intro docs');
    });
  });

  describe('registerManifests', () => {
    let mockApp: Polka;
    let mockGet: ReturnType<typeof vi.fn>;
    let mockPresets: Presets;

    beforeEach(() => {
      mockGet = vi.fn();
      mockApp = { get: mockGet } as unknown as Polka;
      mockPresets = setupMockPresets();
    });

    describe('route registration', () => {
      it('should register two routes', () => {
        registerManifests({ app: mockApp, presets: mockPresets });

        expect(mockGet).toHaveBeenCalledTimes(2);
        expect(mockGet).toHaveBeenCalledWith('/manifests/:name.json', expect.any(Function));
        expect(mockGet).toHaveBeenCalledWith('/manifests/components.html', expect.any(Function));
      });
    });

    describe('/manifests/:name.json route', () => {
      it('should return manifest as JSON when it exists', async () => {
        mockManifests = {
          custom: { data: 'value' },
        };

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[0][1] as RouteHandler;
        const req = { params: { name: 'custom' } };
        const res = createResponse();

        await handler(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
        expect(res.end).toHaveBeenCalledWith(JSON.stringify({ data: 'value' }));
        expect(res.statusCode).toBeUndefined();
      });

      it('should return 404 when manifest does not exist', async () => {
        mockManifests = {
          existing: { data: 'value' },
        };

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[0][1] as RouteHandler;
        const req = { params: { name: 'nonexistent' } };
        const res = createResponse();

        await handler(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.end).toHaveBeenCalledWith('Manifest "nonexistent" not found');
      });

      it('should return 404 when manifests object is empty', async () => {
        mockManifests = {};

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[0][1] as RouteHandler;
        const req = { params: { name: 'any' } };
        const res = createResponse();

        await handler(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.end).toHaveBeenCalledWith('Manifest "any" not found');
      });

      it('returns 404 for components.json when experimentalDocgenServer is enabled', async () => {
        mockPresets = setupMockPresets({
          componentsManifest: true,
          experimentalDocgenServer: true,
        });

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[0][1] as RouteHandler;
        const req = { params: { name: 'components' } };
        const res = createResponse();

        await handler(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.end).toHaveBeenCalledWith(
          'Manifest "components" is not available in dev when experimentalDocgenServer is enabled'
        );
      });

      it('returns 404 for docs.json when experimentalDocgenServer is enabled', async () => {
        mockPresets = setupMockPresets({
          componentsManifest: true,
          experimentalDocgenServer: true,
        });

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[0][1] as RouteHandler;
        const req = { params: { name: 'docs' } };
        const res = createResponse();

        await handler(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.end).toHaveBeenCalledWith(
          'Manifest "docs" is not available in dev when experimentalDocgenServer is enabled'
        );
      });

      it('should handle errors with 500 status and log the error', async () => {
        const error = new Error('Preset failed');
        vi.mocked(mockPresets.apply).mockRejectedValue(error);

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[0][1] as RouteHandler;
        const req = { params: { name: 'custom' } };
        const res = createResponse();

        await handler(req, res);

        expect(vi.mocked(logger).error).toHaveBeenCalledWith(error);
        expect(res.statusCode).toBe(500);
        expect(res.end).toHaveBeenCalledWith(error.toString());
      });

      it('should handle non-Error objects in error handler', async () => {
        const errorString = 'Something went wrong';
        vi.mocked(mockPresets.apply).mockRejectedValue(errorString);

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[0][1] as RouteHandler;
        const req = { params: { name: 'custom' } };
        const res = createResponse();

        await handler(req, res);

        expect(vi.mocked(logger).error).toHaveBeenCalledWith(errorString);
        expect(res.statusCode).toBe(500);
        expect(res.end).toHaveBeenCalledWith(errorString);
      });

      it('should handle when presets.apply returns null/undefined', async () => {
        mockManifests = null;

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[0][1] as RouteHandler;
        const req = { params: { name: 'custom' } };
        const res = createResponse();

        await handler(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.end).toHaveBeenCalledWith('Manifest "custom" not found');
      });
    });

    describe('/manifests/components.html route', () => {
      it('should return rendered HTML when components manifest exists', async () => {
        const componentsManifest: ComponentsManifest = {
          v: 0,
          components: {
            Button: {
              id: 'button',
              name: 'Button',
              path: './Button.tsx',
              stories: [],
              jsDocTags: {},
            },
          },
        };
        mockManifests = {
          components: componentsManifest,
        };

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[1][1] as RouteHandler;
        const req = {};
        const res = createResponse();

        await handler(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
        expect(res.end).toHaveBeenCalled();
        const html = res.end.mock.calls[0]?.[0];
        expect(html).toContain('<!doctype html>');
        expect(html).toContain('Manifest Debugger');
        expect(res.statusCode).toBeUndefined();
      });

      it('should return 404 message when no components or docs manifest exist', async () => {
        mockManifests = {
          other: { data: 'value' },
        };

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[1][1] as RouteHandler;
        const req = {};
        const res = createResponse();

        await handler(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
        expect(res.end).toHaveBeenCalledWith(
          '<pre>No components or docs manifest configured.</pre>'
        );
      });

      it('should return 404 when manifests is empty', async () => {
        mockManifests = {};

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[1][1] as RouteHandler;
        const req = {};
        const res = createResponse();

        await handler(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.end).toHaveBeenCalledWith(
          '<pre>No components or docs manifest configured.</pre>'
        );
      });

      it('should handle errors with 500 status and return error HTML', async () => {
        const error = new Error('Rendering failed');
        error.stack = 'Error: Rendering failed\n  at test.ts:123';
        vi.mocked(mockPresets.apply).mockRejectedValue(error);

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[1][1] as RouteHandler;
        const req = {};
        const res = createResponse();

        await handler(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
        expect(res.end).toHaveBeenCalledWith(
          '<pre>Error: Rendering failed\n  at test.ts:123</pre>'
        );
      });

      it('should handle non-Error objects in error handler', async () => {
        const errorString = 'Something went wrong';
        vi.mocked(mockPresets.apply).mockRejectedValue(errorString);

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[1][1] as RouteHandler;
        const req = {};
        const res = createResponse();

        await handler(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
        expect(res.end).toHaveBeenCalledWith(`<pre>${errorString}</pre>`);
      });

      it('renders docgen-server HTML with MDX from the live service', async () => {
        mockPresets = setupMockPresets({
          componentsManifest: true,
          experimentalDocgenServer: true,
        });
        mockGetIndex.mockResolvedValue({
          v: 5,
          entries: {
            'button--primary': {
              type: 'story',
              subtype: 'story',
              id: 'button--primary',
              name: 'Primary',
              title: 'Button',
              importPath: './button.stories.tsx',
              tags: [Tag.MANIFEST],
            },
          },
        } as StoryIndex);
        mockManifests = {
          components: {
            v: 0,
            components: {
              button: {
                docs: {
                  'button--docs': {
                    id: 'button--docs',
                    name: 'Docs',
                    mdx: {
                      $ref: '../services/addon-docs/mdx/button.json#/components/button/docs/button--docs',
                    },
                  },
                },
              },
            },
            meta: { docgen: 'react-component-meta', durationMs: 0 },
          } as unknown as ComponentsManifest,
          docs: {
            v: 1,
            docs: {
              'intro--docs': {
                id: 'intro--docs',
                name: 'Docs',
                mdx: {
                  $ref: '../services/addon-docs/mdx/intro--docs.json#/components/intro--docs/docs/intro--docs',
                },
              },
            },
          },
        };

        registerTestModuleGraphService();
        registerDocgenService({
          getIndex: () => mockGenerator.getIndex(),
          docgenProvider: async () => ({
            id: 'button',
            name: 'Button',
            path: './button.stories.tsx',
            jsDocTags: {},
            stories: [{ id: 'button--primary', name: 'Primary', snippet: '<Button />' }],
          }),
        });
        registerStoryDocsService({
          getIndex: () => mockGenerator.getIndex(),
          storyDocsProvider: async () => ({
            id: 'button',
            name: 'Button',
            path: './button.stories.tsx',
            stories: {
              'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
            },
          }),
        });
        registerTestMdxService({
          button: {
            id: 'button',
            name: 'button',
            docs: {
              'button--docs': {
                id: 'button--docs',
                name: 'Docs',
                path: './button.mdx',
                title: 'Button Docs',
                content: '# Live attached docs',
              },
            },
          },
          'intro--docs': {
            id: 'intro--docs',
            name: 'Docs',
            docs: {
              'intro--docs': {
                id: 'intro--docs',
                name: 'Docs',
                path: './intro.mdx',
                title: 'Intro',
                content: '# Live unattached docs',
              },
            },
          },
        });

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[1][1] as RouteHandler;
        const res = createResponse();

        await handler({}, res);

        const html = res.end.mock.calls[0]?.[0];
        expect(html).toContain('Live attached docs');
        expect(html).toContain('Live unattached docs');
      });
    });
  });
});
