import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type { ComponentsManifest, Manifests, Presets, StoryIndex } from 'storybook/internal/types';

import { vol } from 'memfs';
import type { Polka, Request, Response } from 'polka';

import { registerManifests, writeManifests } from './manifests';

// Mock dependencies
vi.mock('node:fs/promises', async () => {
  const fs = (await import('memfs')).fs.promises;
  return { default: fs, ...fs };
});
vi.mock('storybook/internal/node-logger');

describe('manifests', () => {
  let mockGenerator: { getIndex: ReturnType<typeof vi.fn> };
  let mockManifests: Manifests;

  const setupMockPresets = () => {
    mockGenerator = { getIndex: vi.fn().mockResolvedValue({} as StoryIndex) };
    mockManifests = {};

    return {
      apply: vi.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'storyIndexGenerator':
            return Promise.resolve(mockGenerator);
          case 'experimental_manifests':
            return Promise.resolve(mockManifests);
          default:
            return Promise.resolve(undefined);
        }
        return Promise.resolve(undefined);
      }),
    } as any as Presets;
  };

  beforeEach(() => {
    vol.reset();
    vi.clearAllMocks();
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
      expect(files['/output/manifests/custom.json']).toBe(JSON.stringify({ data: 'value' }));
      expect(files['/output/manifests/another.json']).toBe(JSON.stringify({ items: [1, 2, 3] }));
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
  });

  describe('registerManifests', () => {
    let mockApp: Polka;
    let mockGet: ReturnType<typeof vi.fn>;
    let mockPresets: Presets;

    beforeEach(() => {
      mockGet = vi.fn();
      mockApp = { get: mockGet } as any;
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

        const handler = mockGet.mock.calls[0][1];
        const req = { params: { name: 'custom' } } as any as Request;
        const res = {
          setHeader: vi.fn(),
          end: vi.fn(),
        } as any as Response;

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

        const handler = mockGet.mock.calls[0][1];
        const req = { params: { name: 'nonexistent' } };
        const res = {
          setHeader: vi.fn(),
          end: vi.fn(),
          statusCode: undefined as number | undefined,
        };

        await handler(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.end).toHaveBeenCalledWith('Manifest "nonexistent" not found');
      });

      it('should return 404 when manifests object is empty', async () => {
        mockManifests = {};

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[0][1];
        const req = { params: { name: 'any' } };
        const res = {
          setHeader: vi.fn(),
          end: vi.fn(),
          statusCode: undefined as number | undefined,
        };

        await handler(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.end).toHaveBeenCalledWith('Manifest "any" not found');
      });

      it('should handle errors with 500 status and log the error', async () => {
        const error = new Error('Preset failed');
        vi.mocked(mockPresets.apply).mockRejectedValue(error);

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[0][1];
        const req = { params: { name: 'custom' } } as any as Request;
        const res = {
          setHeader: vi.fn(),
          end: vi.fn(),
          statusCode: undefined as number | undefined,
        } as any as Response;

        await handler(req, res);

        expect(vi.mocked(logger).error).toHaveBeenCalledWith(error);
        expect(res.statusCode).toBe(500);
        expect(res.end).toHaveBeenCalledWith(error.toString());
      });

      it('should handle non-Error objects in error handler', async () => {
        const errorString = 'Something went wrong';
        vi.mocked(mockPresets.apply).mockRejectedValue(errorString);

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[0][1];
        const req = { params: { name: 'custom' } } as any as Request;
        const res = {
          setHeader: vi.fn(),
          end: vi.fn(),
          statusCode: undefined as number | undefined,
        } as any as Response;

        await handler(req, res);

        expect(vi.mocked(logger).error).toHaveBeenCalledWith(errorString);
        expect(res.statusCode).toBe(500);
        expect(res.end).toHaveBeenCalledWith(errorString);
      });

      it('should handle when presets.apply returns null/undefined', async () => {
        mockManifests = null as any;

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[0][1];
        const req = { params: { name: 'custom' } } as any as Request;
        const res = {
          setHeader: vi.fn(),
          end: vi.fn(),
          statusCode: undefined as number | undefined,
        } as any as Response;

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

        const handler = mockGet.mock.calls[1][1];
        const req = {} as any as Request;
        const res = {
          setHeader: vi.fn(),
          end: vi.fn(),
        } as any as Response;

        await handler(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
        expect(res.end).toHaveBeenCalled();
        const html = (res.end as any).mock.calls[0][0];
        expect(html).toContain('<!doctype html>');
        expect(html).toContain('Components Manifest');
        expect(res.statusCode).toBeUndefined();
      });

      it('should return 404 message when components manifest does not exist', async () => {
        mockManifests = {
          other: { data: 'value' },
        };

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[1][1];
        const req = {};
        const res = {
          setHeader: vi.fn(),
          end: vi.fn(),
          statusCode: undefined as number | undefined,
        };

        await handler(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
        expect(res.end).toHaveBeenCalledWith('<pre>No components manifest configured.</pre>');
      });

      it('should return 404 when manifests is empty', async () => {
        mockManifests = {};

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[1][1];
        const req = {};
        const res = {
          setHeader: vi.fn(),
          end: vi.fn(),
          statusCode: undefined as number | undefined,
        };

        await handler(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.end).toHaveBeenCalledWith('<pre>No components manifest configured.</pre>');
      });

      it('should handle errors with 500 status and return error HTML', async () => {
        const error = new Error('Rendering failed');
        error.stack = 'Error: Rendering failed\n  at test.ts:123';
        vi.mocked(mockPresets.apply).mockRejectedValue(error);

        registerManifests({ app: mockApp, presets: mockPresets });

        const handler = mockGet.mock.calls[1][1];
        const req = {};
        const res = {
          setHeader: vi.fn(),
          end: vi.fn(),
          statusCode: undefined as number | undefined,
        };

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

        const handler = mockGet.mock.calls[1][1];
        const req = {};
        const res = {
          setHeader: vi.fn(),
          end: vi.fn(),
          statusCode: undefined as number | undefined,
        };

        await handler(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
        expect(res.end).toHaveBeenCalledWith(`<pre>${errorString}</pre>`);
      });
    });
  });
});
