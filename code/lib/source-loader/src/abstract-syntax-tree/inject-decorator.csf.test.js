import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import injectDecorator from './inject-decorator';
import getParser from './parsers';

const regex = /\\r\\n|\r\n|\r|\n/g;

describe('inject-decorator', () => {
  describe('positive - ts - csf', () => {
    it('includes storySource parameter in the default exported object', async () => {
      const mockFilePath = './__mocks__/inject-decorator.ts.csf.txt';
      const source = await readFile(mockFilePath, 'utf-8');
      const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
        parser: 'typescript',
      });

      expect(getParser('typescript').parse(result.source)).toBeTruthy();

      expect(result.source).toEqual(expect.stringContaining('"source": "import React from'));
    });

    it('includes storySource parameter in the default exported variable', async () => {
      const mockFilePath = './__mocks__/inject-decorator.ts.csf-meta-var.txt';
      const source = await readFile(mockFilePath, 'utf-8');
      const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
        parser: 'typescript',
      });

      expect(getParser('typescript').parse(result.source)).toBeTruthy();

      expect(result.source).toEqual(expect.stringContaining('"source": "import React from'));
    });

    it('includes storySource parameter in CSf3', async () => {
      const mockFilePath = './__mocks__/inject-decorator.ts.csf3.txt';
      const source = await readFile(mockFilePath, 'utf-8');
      const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
        parser: 'typescript',
      });

      expect(getParser('typescript').parse(result.source)).toBeTruthy();

      expect(result.source).toEqual(expect.stringContaining('"source": "import React from'));
    });
  });

  describe('injectStoryParameters - ts - csf', () => {
    it('includes storySource parameter in the default exported object', async () => {
      const mockFilePath = './__mocks__/inject-parameters.ts.csf.txt';
      const source = await readFile(mockFilePath, 'utf-8');
      const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
        injectStoryParameters: true,
        parser: 'typescript',
      });

      expect(result.source).toContain('Basic.parameters = { storySource: { source:');
      expect(result.source).toContain('WithParams.parameters = { storySource: { source:');
      expect(result.source).toContain('WithDocsParams.parameters = { storySource: { source:');
    });
  });
});
