import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import injectDecorator from './inject-decorator';

describe('inject-decorator', () => {
  describe('positive', () => {
    const mockFilePath = './__mocks__/inject-decorator.stories.txt';
    const source = fs.readFileSync(mockFilePath, 'utf-8');
    const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
      parser: 'javascript',
    });

    it('returns "changed" flag', () => {
      expect(result.changed).toBeTruthy();
    });

    it('injects stories decorator after the all "storiesOf" functions', () => {
      expect(result.source).toMatchSnapshot();
    });

    it('calculates "adds" map', () => {
      expect(result.addsMap).toMatchSnapshot();
    });
  });

  describe('positive - angular', () => {
    const mockFilePath = './__mocks__/inject-decorator.angular-stories.txt';
    const source = fs.readFileSync(mockFilePath, 'utf-8');
    const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
      parser: 'typescript',
    });

    it('returns "changed" flag', () => {
      expect(result.changed).toBeTruthy();
    });

    it('injects stories decorator after the all "storiesOf" functions', () => {
      expect(result.source).toMatchSnapshot();
    });

    it('calculates "adds" map', () => {
      expect(result.addsMap).toMatchSnapshot();
    });
  });

  describe('positive - flow', () => {
    const mockFilePath = './__mocks__/inject-decorator.flow-stories.txt';
    const source = fs.readFileSync(mockFilePath, 'utf-8');
    const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
      parser: 'flow',
    });

    it('returns "changed" flag', () => {
      expect(result.changed).toBeTruthy();
    });

    it('injects stories decorator after the all "storiesOf" functions', () => {
      expect(result.source).toMatchSnapshot();
    });

    it('calculates "adds" map', () => {
      expect(result.addsMap).toMatchSnapshot();
    });
  });

  describe('positive - ts', () => {
    const mockFilePath = './__mocks__/inject-decorator.ts.txt';
    const source = fs.readFileSync(mockFilePath, 'utf-8');
    const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
      parser: 'typescript',
    });

    it('returns "changed" flag', () => {
      expect(result.changed).toBeTruthy();
    });

    it('injects stories decorator after the all "storiesOf" functions', () => {
      expect(result.source).toMatchSnapshot();
    });

    it('calculates "adds" map', () => {
      expect(result.addsMap).toMatchSnapshot();
    });
  });

  describe('stories with ugly comments', () => {
    const mockFilePath = './__mocks__/inject-decorator.ugly-comments-stories.txt';
    const source = fs.readFileSync(mockFilePath, 'utf-8');
    const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
      parser: 'javascript',
    });

    it('should delete ugly comments from the generated story source', () => {
      expect(result.storySource).toMatchSnapshot();
    });
  });

  describe('stories with ugly comments in ts', () => {
    const mockFilePath = './__mocks__/inject-decorator.ts.ugly-comments-stories.txt';
    const source = fs.readFileSync(mockFilePath, 'utf-8');
    const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
      parser: 'typescript',
    });

    it('should delete ugly comments from the generated story source', () => {
      expect(result.storySource).toMatchSnapshot();
    });
  });

  it('will not change the source when there are no "storiesOf" functions', () => {
    const mockFilePath = './__mocks__/inject-decorator.no-stories.txt';
    const source = fs.readFileSync(mockFilePath, 'utf-8');

    const result = injectDecorator(source, path.resolve(__dirname, mockFilePath));

    expect(result.changed).toBeFalsy();
    expect(result.addsMap).toEqual({});
    expect(result.source).toMatchSnapshot();
  });

  describe('injectDecorator option is false', () => {
    const mockFilePath = './__mocks__/inject-decorator.stories.txt';
    const source = fs.readFileSync(mockFilePath, 'utf-8');
    const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
      injectDecorator: false,
      parser: 'javascript',
    });

    it('does not inject stories decorator after the all "storiesOf" functions', () => {
      expect(result.source).toMatchSnapshot();
    });
  });

  describe('injectDecorator option is false - angular', () => {
    const mockFilePath = './__mocks__/inject-decorator.angular-stories.txt';
    const source = fs.readFileSync(mockFilePath, 'utf-8');
    const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
      injectDecorator: false,
      parser: 'typescript',
    });

    it('does not inject stories decorator after the all "storiesOf" functions', () => {
      expect(result.source).toMatchSnapshot();
    });
  });

  describe('injectDecorator option is false - flow', () => {
    const mockFilePath = './__mocks__/inject-decorator.flow-stories.txt';
    const source = fs.readFileSync(mockFilePath, 'utf-8');
    const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
      injectDecorator: false,
      parser: 'flow',
    });

    it('does not inject stories decorator after the all "storiesOf" functions', () => {
      expect(result.source).toMatchSnapshot();
    });
  });

  describe('injectDecorator option is false - ts', () => {
    const mockFilePath = './__mocks__/inject-decorator.ts.txt';
    const source = fs.readFileSync(mockFilePath, 'utf-8');
    const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
      injectDecorator: false,
      parser: 'typescript',
    });

    it('does not inject stories decorator after the all "storiesOf" functions', () => {
      expect(result.source).toMatchSnapshot();
    });
  });
});
