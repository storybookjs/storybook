import { describe, expect, it } from 'vitest';

import type { ManifestDeclaration } from './types.ts';
import { classifyDeclaration, isBackedByAttribute } from './declaration-api.ts';

type DeclarationApiCase = {
  name: string;
  input: Partial<ManifestDeclaration>;
  expected: {
    attributes: Array<{ name: string; field: string | undefined }>;
    fields: string[];
    methods: string[];
  };
};

type IsBackedByAttributeCase = {
  name: string;
  input: Partial<ManifestDeclaration>;
  fieldName: string;
  expected: boolean;
};

const declaration = (input: Partial<ManifestDeclaration>): ManifestDeclaration => ({
  customElement: true,
  kind: 'class',
  name: 'XCard',
  tagName: 'x-card',
  ...input,
});

function summarize(input: Partial<ManifestDeclaration>): DeclarationApiCase['expected'] {
  const api = classifyDeclaration(declaration(input));

  return {
    attributes: api.attributes.map(({ attribute, field }) => ({
      name: attribute.name,
      field: field?.name,
    })),
    fields: api.fields.map((field) => field.name),
    methods: api.methods.map((method) => method.name),
  };
}

describe('classifyDeclaration', () => {
  it.each<DeclarationApiCase>([
    {
      name: 'pairs an attribute to its fieldName field',
      input: {
        attributes: [{ name: 'old-size', fieldName: 'oldSize' }],
        members: [{ kind: 'field', name: 'oldSize' }],
      },
      expected: {
        attributes: [{ name: 'old-size', field: 'oldSize' }],
        fields: ['oldSize'],
        methods: [],
      },
    },
    {
      name: 'keeps an attribute without fieldName unpaired from a same-name field',
      input: {
        attributes: [{ name: 'size' }],
        members: [{ kind: 'field', name: 'size' }],
      },
      expected: {
        attributes: [{ name: 'size', field: undefined }],
        fields: ['size'],
        methods: [],
      },
    },
    {
      name: 'drops attributes backed by private protected static and hash fields',
      input: {
        attributes: [
          { name: 'secret', fieldName: 'secret' },
          { name: 'hidden', fieldName: 'hidden' },
          { name: 'global', fieldName: 'global' },
          { name: 'token', fieldName: '#token' },
          { name: 'label', fieldName: 'label' },
        ],
        members: [
          { kind: 'field', name: 'secret', privacy: 'private' },
          { kind: 'field', name: 'hidden', privacy: 'protected' },
          { kind: 'field', name: 'global', static: true },
          { kind: 'field', name: '#token' },
          { kind: 'field', name: 'label' },
        ],
      },
      expected: {
        attributes: [{ name: 'label', field: 'label' }],
        fields: ['label'],
        methods: [],
      },
    },
    {
      name: 'keeps public methods only',
      input: {
        members: [
          { kind: 'method', name: 'show' },
          { kind: 'method', name: 'secret', privacy: 'private' },
          { kind: 'method', name: 'global', static: true },
          { kind: 'method', name: '#hide' },
        ],
      },
      expected: {
        attributes: [],
        fields: [],
        methods: ['show'],
      },
    },
  ])('$name', ({ input, expected }) => {
    expect(summarize(input)).toEqual(expected);
  });

  it.each<IsBackedByAttributeCase>([
    {
      name: 'explicit fieldName field',
      input: {
        attributes: [{ name: 'old-size', fieldName: 'oldSize' }],
        members: [{ kind: 'field', name: 'oldSize' }],
      },
      fieldName: 'oldSize',
      expected: true,
    },
    {
      name: 'same-name attribute',
      input: {
        attributes: [{ name: 'size' }],
        members: [{ kind: 'field', name: 'size' }],
      },
      fieldName: 'size',
      expected: true,
    },
    {
      name: 'unrelated field',
      input: {
        attributes: [{ name: 'size' }],
        members: [{ kind: 'field', name: 'label' }],
      },
      fieldName: 'label',
      expected: false,
    },
  ])(
    'identifies whether a field is backed by an attribute: $name',
    ({ input, fieldName, expected }) => {
      const api = classifyDeclaration(declaration(input));
      const field = api.fields.find(({ name }) => name === fieldName);

      expect(field).toBeDefined();
      expect(field ? isBackedByAttribute(field, api.attributes) : undefined).toBe(expected);
    }
  );
});
