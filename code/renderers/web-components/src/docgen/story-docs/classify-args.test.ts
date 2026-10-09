import { describe, expect, it } from 'vitest';

import type {
  ManifestClassField,
  ManifestDeclaration,
} from '../component-docgen/manifest/types.ts';
import { DEFAULT_TYPE_PROPERTY } from '../component-docgen/arg-types/alt-type.ts';
import { mapArgTypes } from '../component-docgen/arg-types/map-arg-types.ts';
import { classifyArg, type ArgBinding } from './classify-args.ts';

const declaration = {
  kind: 'class',
  name: 'TestElement',
  customElement: true,
  tagName: 'test-element',
  attributes: [
    { name: 'label' },
    { name: 'count', fieldName: 'count' },
    { name: 'active', fieldName: 'active' },
    { name: 'has-slot' },
  ],
  members: [
    { kind: 'field', name: 'count' },
    { kind: 'field', name: 'active', default: 'true' },
    { kind: 'field', name: 'items' },
    { kind: 'field', name: 'tone', attribute: 'tone-attr' } as ManifestClassField & {
      attribute: string;
    },
    { kind: 'method', name: 'refresh' },
  ],
  events: [{ name: 'shape-change', type: { text: 'CustomEvent' } }],
  slots: [{ name: '' }, { name: 'actions' }],
  cssParts: [{ name: 'panel' }],
  cssStates: [{ name: 'active' }],
  cssProperties: [{ name: '--accent' }],
} satisfies ManifestDeclaration;
const argTypes = mapArgTypes(declaration, DEFAULT_TYPE_PROPERTY);

describe('classifyArg', () => {
  it.each<{ key: string; isFunction: boolean; expected: ArgBinding }>([
    {
      key: 'label',
      isFunction: false,
      expected: { kind: 'attribute', name: 'label', viaField: false },
    },
    {
      key: 'count',
      isFunction: false,
      expected: { kind: 'attribute', name: 'count', viaField: true },
    },
    {
      key: 'active',
      isFunction: false,
      expected: { kind: 'attribute', name: 'active', viaField: true, defaultValue: 'true' },
    },
    { key: 'items', isFunction: false, expected: { kind: 'property', name: 'items' } },
    {
      key: 'tone',
      isFunction: false,
      expected: { kind: 'attribute', name: 'tone-attr', viaField: true },
    },
    { key: '--accent', isFunction: false, expected: { kind: 'cssProperty', name: '--accent' } },
    { key: '--nope', isFunction: false, expected: { kind: 'unknown' } },
    { key: 'shape-change-event', isFunction: false, expected: { kind: 'listener' } },
    { key: 'onShapeChange', isFunction: false, expected: { kind: 'unknown' } },
    { key: 'anything', isFunction: true, expected: { kind: 'listener' } },
    { key: 'refresh-method', isFunction: false, expected: { kind: 'method' } },
    { key: 'default-slot', isFunction: false, expected: { kind: 'slot', name: 'default' } },
    { key: 'actions-slot', isFunction: false, expected: { kind: 'slot', name: 'actions' } },
    { key: 'panel-part', isFunction: false, expected: { kind: 'cssPart', name: 'panel' } },
    { key: 'active-state', isFunction: false, expected: { kind: 'cssState', name: 'active' } },
    {
      key: 'has-slot',
      isFunction: false,
      expected: { kind: 'attribute', name: 'has-slot', viaField: false },
    },
    { key: 'nope', isFunction: false, expected: { kind: 'unknown' } },
  ])('$key', ({ key, isFunction, expected }) => {
    expect(classifyArg(key, isFunction, argTypes, declaration)).toEqual(expected);
  });
});
