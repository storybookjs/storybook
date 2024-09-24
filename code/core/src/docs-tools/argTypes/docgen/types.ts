import type { StrictArgTypes } from '@storybook/core/types';

import type { Component } from '../types';
import type { PropDef } from './PropDef';

export type PropsExtractor = (component: Component) => { rows?: PropDef[] } | null;

export type ArgTypesExtractor = (component: Component) => StrictArgTypes | null;

export interface DocgenType {
  name: string;
  description?: string;
  required?: boolean;
  value?: any; // Seems like this can be many things
}

export interface DocgenPropType extends DocgenType {
  value?: any;
  raw?: string;
  computed?: boolean;
}

export interface DocgenFlowType extends DocgenType {
  type?: string;
  raw?: string;
  signature?: any;
  elements?: any[];
}

export interface DocgenTypeScriptType extends DocgenType {
  raw?: string;
}

// export type DocgenType = DocgenPropType | DocgenFlowType | DocgenTypeScriptType;

export interface DocgenPropDefaultValue {
  value: string;
  computed?: boolean;
  func?: boolean;
}

export interface DocgenInfo {
  type: DocgenPropType;
  flowType?: DocgenFlowType;
  tsType?: DocgenTypeScriptType;
  required: boolean;
  description: string;
  defaultValue: DocgenPropDefaultValue;
}

export enum TypeSystem {
  JAVASCRIPT = 'JavaScript',
  FLOW = 'Flow',
  TYPESCRIPT = 'TypeScript',
  UNKNOWN = 'Unknown',
}

export type { PropDef };
