import { describe, it, expect, vi } from 'vitest';
import type { Renderer, StoryAnnotationsOrFn } from '@storybook/core/types';

import { normalizeStory } from './normalizeStory';

vi.mock('@storybook/core/client-logger');

describe('normalizeStory', () => {
  describe('id generation', () => {
    it('respects component id', () => {
      expect(normalizeStory('name', {}, { title: 'title', id: 'component-id' }).id).toEqual(
        'component-id--name'
      );
    });

    it('respects parameters.__id', () => {
      expect(
        normalizeStory(
          'name',
          { parameters: { __id: 'story-id' } },
          { title: 'title', id: 'component-id' }
        ).id
      ).toEqual('story-id');
    });
  });

  describe('name', () => {
    it('preferences story.name over story.storyName', () => {
      expect(
        normalizeStory(
          'export',
          { name: 'name', storyName: 'storyName' },
          { id: 'title', title: 'title' }
        ).name
      ).toEqual('name');
      expect(
        normalizeStory('export', { storyName: 'storyName' }, { id: 'title', title: 'title' }).name
      ).toEqual('storyName');
    });

    it('falls back to capitalized export name', () => {
      expect(normalizeStory('exportOne', {}, { id: 'title', title: 'title' }).name).toEqual(
        'Export One'
      );
    });
  });

  describe('user-provided story function', () => {
    it('should normalize into an object', () => {
      const storyFn = () => {};
      const meta = { id: 'title', title: 'title' };
      expect(normalizeStory('storyExport', storyFn, meta)).toMatchInlineSnapshot(`
        {
          "argTypes": {},
          "args": {},
          "beforeEach": [],
          "decorators": [],
          "id": "title--story-export",
          "loaders": [],
          "moduleExport": [Function],
          "name": "Story Export",
          "parameters": {},
          "tags": [],
          "userStoryFn": [Function],
        }
      `);
    });
  });

  describe('user-provided story object', () => {
    describe('render function', () => {
      it('implicit render function', () => {
        const storyObj = {};
        const meta = { id: 'title', title: 'title' };
        const normalized = normalizeStory('storyExport', storyObj, meta);
        expect(normalized.render).toBeUndefined();
      });

      it('user-provided story render function', () => {
        const storyObj = { render: vi.fn() };
        const meta = { id: 'title', title: 'title', render: vi.fn() };
        const normalized = normalizeStory('storyExport', storyObj, meta);
        expect(normalized.render).toBe(storyObj.render);
      });

      it('user-provided meta render function', () => {
        const storyObj = {};
        const meta = { id: 'title', title: 'title', render: vi.fn() };
        const normalized = normalizeStory('storyExport', storyObj, meta);
        expect(normalized.render).toBeUndefined();
      });
    });

    describe('play function', () => {
      it('no render function', () => {
        const storyObj = {};
        const meta = { id: 'title', title: 'title' };
        const normalized = normalizeStory('storyExport', storyObj, meta);
        expect(normalized.play).toBeUndefined();
      });

      it('user-provided story render function', () => {
        const storyObj = { play: vi.fn() };
        const meta = { id: 'title', title: 'title', play: vi.fn() };
        const normalized = normalizeStory('storyExport', storyObj, meta);
        expect(normalized.play).toBe(storyObj.play);
      });

      it('user-provided meta render function', () => {
        const storyObj = {};
        const meta = { id: 'title', title: 'title', play: vi.fn() };
        const normalized = normalizeStory('storyExport', storyObj, meta);
        expect(normalized.play).toBeUndefined();
      });
    });

    describe('annotations', () => {
      it('empty annotations', () => {
        const storyObj = {};
        const meta = { id: 'title', title: 'title' };
        const normalized = normalizeStory('storyExport', storyObj, meta);
        expect(normalized).toMatchInlineSnapshot(`
          {
            "argTypes": {},
            "args": {},
            "beforeEach": [],
            "decorators": [],
            "id": "title--story-export",
            "loaders": [],
            "moduleExport": {},
            "name": "Story Export",
            "parameters": {},
            "tags": [],
          }
        `);
        expect(normalized.moduleExport).toBe(storyObj);
      });

      it('full annotations', () => {
        const storyObj: StoryAnnotationsOrFn<Renderer> = {
          name: 'story name',
          parameters: { storyParam: 'val' },
          decorators: [() => {}],
          loaders: [async () => ({})],
          args: { storyArg: 'val' },
          argTypes: { storyArgType: { type: 'string' } },
        };
        const meta = { id: 'title', title: 'title' };
        const { moduleExport, ...normalized } = normalizeStory('storyExport', storyObj, meta);
        expect(normalized).toMatchInlineSnapshot(`
          {
            "argTypes": {
              "storyArgType": {
                "name": "storyArgType",
                "type": {
                  "name": "string",
                },
              },
            },
            "args": {
              "storyArg": "val",
            },
            "beforeEach": [],
            "decorators": [
              [Function],
            ],
            "id": "title--story-export",
            "loaders": [
              [Function],
            ],
            "name": "story name",
            "parameters": {
              "storyParam": "val",
            },
            "tags": [],
          }
        `);
        expect(moduleExport).toBe(storyObj);
      });

      it('prefers new annotations to legacy, but combines', () => {
        const storyObj: StoryAnnotationsOrFn<Renderer> = {
          name: 'story name',
          parameters: { storyParam: 'val' },
          decorators: [() => {}],
          loaders: [async () => ({})],
          args: { storyArg: 'val' },
          argTypes: { storyArgType: { type: 'string' } },
          story: {
            parameters: { storyParam2: 'legacy' },
            decorators: [() => {}],
            loaders: [async () => ({})],
            args: { storyArg2: 'legacy' },
            argTypes: { storyArgType2: { type: 'string' } },
          },
        };
        const meta = { id: 'title', title: 'title' };
        const { moduleExport, ...normalized } = normalizeStory('storyExport', storyObj, meta);
        expect(normalized).toMatchInlineSnapshot(`
          {
            "argTypes": {
              "storyArgType": {
                "name": "storyArgType",
                "type": {
                  "name": "string",
                },
              },
              "storyArgType2": {
                "name": "storyArgType2",
                "type": {
                  "name": "string",
                },
              },
            },
            "args": {
              "storyArg": "val",
              "storyArg2": "legacy",
            },
            "beforeEach": [],
            "decorators": [
              [Function],
              [Function],
            ],
            "id": "title--story-export",
            "loaders": [
              [Function],
              [Function],
            ],
            "name": "story name",
            "parameters": {
              "storyParam": "val",
              "storyParam2": "legacy",
            },
            "tags": [],
          }
        `);
        expect(moduleExport).toBe(storyObj);
      });
    });
  });
});
