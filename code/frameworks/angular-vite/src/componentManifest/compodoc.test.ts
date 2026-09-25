import { describe, expect, it } from 'vitest';

import { findComponentByName } from './compodoc.ts';
import type { CompodocJson } from './compodocTypes.ts';

const baseJson: CompodocJson = {
  components: [
    {
      name: 'ButtonComponent',
      type: 'component',
      selector: 'app-button',
      inputsClass: [],
      outputsClass: [],
      propertiesClass: [],
      methodsClass: [],
    },
  ],
  directives: [
    {
      name: 'HighlightDirective',
      type: 'directive',
      selector: '[appHighlight]',
      inputsClass: [],
      outputsClass: [],
      propertiesClass: [],
      methodsClass: [],
    },
  ],
  pipes: [
    {
      name: 'TruncatePipe',
      type: 'class',
      properties: [],
      methods: [],
    },
  ],
  injectables: [
    {
      name: 'AuthService',
      type: 'injectable',
      properties: [],
      methods: [],
    },
  ],
  classes: [
    {
      name: 'BaseClass',
      ngname: 'BaseClass',
      type: 'pipe',
      properties: [],
      methods: [],
    },
  ],
};

describe('findComponentByName', () => {
  it('finds a component by name', () => {
    const result = findComponentByName('ButtonComponent', baseJson);
    expect(result?.name).toBe('ButtonComponent');
  });

  it('finds a directive by name', () => {
    const result = findComponentByName('HighlightDirective', baseJson);
    expect(result?.name).toBe('HighlightDirective');
  });

  it('finds a pipe by name', () => {
    const result = findComponentByName('TruncatePipe', baseJson);
    expect(result?.name).toBe('TruncatePipe');
  });

  it('finds an injectable by name', () => {
    const result = findComponentByName('AuthService', baseJson);
    expect(result?.name).toBe('AuthService');
  });

  it('finds a class by name', () => {
    const result = findComponentByName('BaseClass', baseJson);
    expect(result?.name).toBe('BaseClass');
  });

  it('returns undefined for unknown name', () => {
    const result = findComponentByName('UnknownComponent', baseJson);
    expect(result).toBeUndefined();
  });

  it('is case-sensitive', () => {
    const result = findComponentByName('buttoncomponent', baseJson);
    expect(result).toBeUndefined();
  });

  it('prefers components over directives with same name', () => {
    const json: CompodocJson = {
      ...baseJson,
      components: [
        {
          name: 'SharedName',
          type: 'component',
          selector: 'shared',
          inputsClass: [],
          outputsClass: [],
          propertiesClass: [],
          methodsClass: [],
        },
      ],
      directives: [
        {
          name: 'SharedName',
          type: 'directive',
          selector: '[shared]',
          inputsClass: [],
          outputsClass: [],
          propertiesClass: [],
          methodsClass: [],
        },
      ],
    };
    const result = findComponentByName('SharedName', json);
    expect(result?.type).toBe('component');
  });
});
