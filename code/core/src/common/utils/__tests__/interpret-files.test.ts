import { describe, afterEach, it, expect } from 'vitest';
import mock from 'mock-fs';
import { getInterpretedFile } from '../interpret-files';

describe('interpret-files', () => {
  it('will interpret file as file.ts when it exists in fs', () => {
    mock({
      'path/to/file.ts': 'ts file contents',
    });

    const file = getInterpretedFile('path/to/file');

    expect(file).toEqual('path/to/file.ts');
  });

  it('will interpret file as file.js when both are in fs', () => {
    mock({
      'path/to/file.js': 'js file contents',
      'path/to/file.ts': 'ts file contents',
    });

    const file = getInterpretedFile('path/to/file');

    expect(file).toEqual('path/to/file.js');
  });

  it('will interpret file even if extension is already present', () => {
    mock({
      'path/to/file.js': 'js file contents',
      'path/to/file.ts': 'ts file contents',
    });

    const file = getInterpretedFile('path/to/file.js');

    expect(file).toEqual('path/to/file.js');
  });

  it('will return undefined if there is no candidate of a file in fs', () => {
    mock({
      'path/to/file.js': 'js file contents',
    });

    const file = getInterpretedFile('path/to/file2');

    expect(file).toBeUndefined();
  });

  it('will interpret file as file.mts when it exists in fs', () => {
    mock({
      'path/to/file.mts': 'ts file contents',
    });

    const file = getInterpretedFile('path/to/file');

    expect(file).toEqual('path/to/file.mts');
  });

  it('will interpret file as file.cts when it exists in fs', () => {
    mock({
      'path/to/file.cts': 'ts file contents',
    });

    const file = getInterpretedFile('path/to/file');

    expect(file).toEqual('path/to/file.cts');
  });

  afterEach(mock.restore);
});
