import { beforeEach, describe, expect, it, vi } from 'vitest';

import fs from 'node:fs';
import path from 'pathe';

import type { CompodocJson } from '../client/compodoc-types';
import {
  extractDescription,
  findComponentInCompodoc,
  getComponentFilePath,
  invalidateCompodocCache,
  loadCompodocJson,
} from './compodocDocgen';

vi.mock('node:fs', { spy: true });

const sampleCompodocJson: CompodocJson = {
  components: [
    {
      name: 'ButtonComponent',
      type: 'component',
      description: '<p>A button component</p>',
      rawdescription: 'A button component',
      selector: 'app-button',
      inputsClass: [
        {
          name: 'label',
          type: 'string',
          optional: false,
          description: 'The button label',
          rawdescription: 'The button label',
        },
        {
          name: 'primary',
          type: 'boolean',
          optional: true,
          defaultValue: 'false',
          description: 'Primary styling',
          rawdescription: 'Primary styling',
        },
      ],
      outputsClass: [
        {
          name: 'onClick',
          type: 'EventEmitter<void>',
          optional: false,
          description: 'Emitted on click',
          rawdescription: 'Emitted on click',
        },
      ],
      propertiesClass: [],
      methodsClass: [],
      file: 'src/app/button/button.component.ts',
    } as any,
  ],
  directives: [
    {
      name: 'HighlightDirective',
      type: 'directive',
      description: '<p>Highlights elements</p>',
      rawdescription: 'Highlights elements',
      inputsClass: [],
      outputsClass: [],
      propertiesClass: [],
      methodsClass: [],
    },
  ],
  pipes: [
    {
      name: 'TruncatePipe',
      type: 'pipe' as any,
      properties: [],
      methods: [],
      description: 'Truncates text',
    },
  ],
  injectables: [
    {
      name: 'DataService',
      type: 'injectable',
      properties: [],
      methods: [],
      description: 'A data service',
    },
  ],
  classes: [
    {
      name: 'AppConfig',
      ngname: 'AppConfig',
      type: 'pipe' as any,
      properties: [],
      methods: [],
      description: 'App configuration',
    },
  ],
};

describe('loadCompodocJson', () => {
  beforeEach(() => {
    invalidateCompodocCache();
    vi.resetAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(sampleCompodocJson));
  });

  it('should load and parse documentation.json from the workspace root', () => {
    const result = loadCompodocJson('/my/workspace');

    expect(fs.existsSync).toHaveBeenCalledWith(path.join('/my/workspace', 'documentation.json'));
    expect(result).not.toBeNull();
    expect(result!.components).toHaveLength(1);
    expect(result!.components[0].name).toBe('ButtonComponent');
  });

  it('should return null when documentation.json does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = loadCompodocJson('/my/workspace');

    expect(result).toBeNull();
  });

  it('should return null when JSON is invalid', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('not valid json');

    const result = loadCompodocJson('/my/workspace');

    expect(result).toBeNull();
  });

  it('should cache the result after first load', () => {
    const result1 = loadCompodocJson('/my/workspace');
    const result2 = loadCompodocJson('/my/workspace');

    expect(result1).toBe(result2);
    // readFileSync should only be called once due to caching
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
  });

  it('should reload after cache invalidation', () => {
    loadCompodocJson('/my/workspace');
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);

    invalidateCompodocCache();
    loadCompodocJson('/my/workspace');
    expect(fs.readFileSync).toHaveBeenCalledTimes(2);
  });
});

describe('findComponentInCompodoc', () => {
  it('should find a component by name', () => {
    const result = findComponentInCompodoc('ButtonComponent', sampleCompodocJson);
    expect(result).toBeDefined();
    expect(result!.name).toBe('ButtonComponent');
  });

  it('should find a directive by name', () => {
    const result = findComponentInCompodoc('HighlightDirective', sampleCompodocJson);
    expect(result).toBeDefined();
    expect(result!.name).toBe('HighlightDirective');
  });

  it('should find a pipe by name', () => {
    const result = findComponentInCompodoc('TruncatePipe', sampleCompodocJson);
    expect(result).toBeDefined();
    expect(result!.name).toBe('TruncatePipe');
  });

  it('should find an injectable by name', () => {
    const result = findComponentInCompodoc('DataService', sampleCompodocJson);
    expect(result).toBeDefined();
    expect(result!.name).toBe('DataService');
  });

  it('should find a class by name', () => {
    const result = findComponentInCompodoc('AppConfig', sampleCompodocJson);
    expect(result).toBeDefined();
    expect(result!.name).toBe('AppConfig');
  });

  it('should return undefined for unknown name', () => {
    const result = findComponentInCompodoc('NonExistentComponent', sampleCompodocJson);
    expect(result).toBeUndefined();
  });
});

describe('extractDescription', () => {
  it('should prefer rawdescription over description', () => {
    const result = extractDescription(sampleCompodocJson.components[0]);
    expect(result).toBe('A button component');
  });

  it('should fall back to description when rawdescription is missing', () => {
    const result = extractDescription({
      ...sampleCompodocJson.components[0],
      rawdescription: undefined,
    } as any);
    expect(result).toBe('<p>A button component</p>');
  });

  it('should return undefined for undefined input', () => {
    const result = extractDescription(undefined);
    expect(result).toBeUndefined();
  });
});

describe('getComponentFilePath', () => {
  it('should return the file path from component data', () => {
    const result = getComponentFilePath(sampleCompodocJson.components[0]);
    expect(result).toBe('src/app/button/button.component.ts');
  });

  it('should return undefined when file is not set', () => {
    const result = getComponentFilePath(sampleCompodocJson.directives[0]);
    expect(result).toBeUndefined();
  });
});
