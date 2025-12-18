import { fileURLToPath } from 'node:url';

import type { ComponentDocgenData, ComponentDocgenPropType } from 'storybook/internal/core-server';
import type { PresetProperty } from 'storybook/internal/types';

import type {
  ElementsType,
  LiteralType,
  ObjectSignatureType,
  PropDescriptor as ReactDocgenPropDescriptor,
  TSFunctionSignatureType,
  TypeDescriptor,
} from 'react-docgen';

import { resolvePackageDir } from '../../../core/src/shared/utils/module';
import { getComponentDocgen } from './componentManifest/getComponentProps';

export const addons: PresetProperty<'addons'> = [
  import.meta.resolve('@storybook/react-dom-shim/preset'),
];

export { componentManifestGenerator as experimental_componentManifestGenerator } from './componentManifest/generator';

export { enrichCsf as experimental_enrichCsf } from './enrichCsf';

type GetDocgenDataOptions = {
  componentFilePath?: string;
  componentExportName?: string;
};

type ReactDocgenTsType = TypeDescriptor<TSFunctionSignatureType>;
type ReactDocgenElementsType = ElementsType<TSFunctionSignatureType>;
type ReactDocgenObjectSignatureType = ObjectSignatureType<TSFunctionSignatureType>;
type ReactDocgenLiteralType = LiteralType;

function isElementsType(value: ReactDocgenTsType): value is ReactDocgenElementsType {
  return 'elements' in value;
}

function isObjectSignatureType(value: ReactDocgenTsType): value is ReactDocgenObjectSignatureType {
  return value.name === 'signature' && (value as ReactDocgenObjectSignatureType).type === 'object';
}

function isLiteralType(value: ReactDocgenTsType): value is ReactDocgenLiteralType {
  return value.name === 'literal';
}

function mapReactDocgenType(docgenType: ReactDocgenTsType): ComponentDocgenPropType {
  const name = docgenType.name;

  switch (name) {
    case 'boolean':
      return { kind: 'boolean' };
    case 'string':
      return { kind: 'string' };
    case 'number':
      return { kind: 'number' };
    case 'Date':
      return { kind: 'date' };
    case 'JSX.Element':
    case 'ComponentType':
    case 'ReactComponentType':
    case 'ReactElement':
    case 'ReactReactElement':
    case 'ElementType':
    case 'ReactElementType':
    case 'ReactNode':
    case 'ReactReactNode':
      return { kind: 'node', renderer: 'react' };
    case 'signature': {
      // Object-signature: `{ foo: string }`
      if (isObjectSignatureType(docgenType)) {
        const properties: Record<string, ComponentDocgenPropType> = {};
        for (const prop of docgenType.signature.properties) {
          const key = typeof prop.key === 'string' ? prop.key : prop.key.name;
          properties[key] = mapReactDocgenType(prop.value);
        }
        return { kind: 'object', properties };
      }

      // Function signature
      return { kind: 'function' };
    }
    case 'union': {
      const elements = isElementsType(docgenType) ? docgenType.elements : [];
      return { kind: 'union', elements: elements.map(mapReactDocgenType) };
    }
    case 'Array': {
      const element = isElementsType(docgenType) ? docgenType.elements[0] : undefined;

      if (!element) {
        return { kind: 'array', element: { kind: 'any' } };
      }

      const mapped = mapReactDocgenType(element);
      // If it looks like an unresolved custom type, map as 'other' so core can be conservative.
      if (
        element.name &&
        ![
          'string',
          'number',
          'boolean',
          'Date',
          'ReactNode',
          'ReactElementType',
          'signature',
          'union',
          'Array',
          'tuple',
          'literal',
          'null',
          'void',
          'any',
          'unknown',
        ].includes(element.name)
      ) {
        return { kind: 'array', element: { kind: 'other', name: element.name } };
      }
      return { kind: 'array', element: mapped };
    }
    case 'tuple': {
      const elements = isElementsType(docgenType) ? docgenType.elements : [];
      return { kind: 'tuple', elements: elements.map(mapReactDocgenType) };
    }
    case 'literal':
      return { kind: 'literal', value: isLiteralType(docgenType) ? docgenType.value : undefined };
    case 'null':
      return { kind: 'null' };
    case 'void':
      return { kind: 'void' };
    case 'any':
      return { kind: 'any' };
    case 'unknown':
      return { kind: 'unknown' };
    default:
      return { kind: 'other', name };
  }
}

/**
 * Renderer-level hook used by core to extract docgen for story generation, without requiring core
 * to import any renderer packages directly.
 */
export async function getDocgenData(
  _input: unknown,
  options: GetDocgenDataOptions
): Promise<ComponentDocgenData | null> {
  const { componentFilePath, componentExportName } = (options ?? {}) as GetDocgenDataOptions;

  if (!componentFilePath) {
    return null;
  }

  const docgen = getComponentDocgen(componentFilePath, componentExportName);

  if (!docgen || docgen.reactDocgen.type !== 'success') {
    return null;
  }

  const props = docgen.reactDocgen.data.props ?? {};
  const mapped: ComponentDocgenData = { props: {} };

  for (const [propName, propInfo] of Object.entries(props)) {
    const tsType = (propInfo as ReactDocgenPropDescriptor).tsType as ReactDocgenTsType | undefined;
    if (!tsType) {
      continue;
    }
    mapped.props![propName] = {
      required: Boolean((propInfo as ReactDocgenPropDescriptor).required),
      type: mapReactDocgenType(tsType),
    };
  }

  return mapped;
}

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  input = [],
  options
) => {
  const [docsConfig, features] = await Promise.all([
    options.presets.apply('docs', {}, options),
    options.presets.apply('features', {}, options),
  ]);
  const docsEnabled = Object.keys(docsConfig).length > 0;
  const experimentalRSC = features?.experimentalRSC;
  const result: string[] = [];

  return result
    .concat(input)
    .concat([
      fileURLToPath(import.meta.resolve('@storybook/react/entry-preview')),
      fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-argtypes')),
    ])
    .concat(
      docsEnabled ? [fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-docs'))] : []
    )
    .concat(
      experimentalRSC
        ? [fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-rsc'))]
        : []
    );
};

// TODO: Evaluate if this is correct after removing pnp compatibility code in SB11

/**
 * Try to resolve react and react-dom from the root node_modules of the project addon-docs uses this
 * to alias react and react-dom to the project's version when possible If the user doesn't have an
 * explicit dependency on react this will return the existing values Which will be the versions
 * shipped with addon-docs
 *
 * We do the exact same thing in the common preset, but that will fail in Yarn PnP because
 *
 * Storybook/internal/core-server doesn't have a peer dependency on react This will make
 *
 * @storybook/react projects work in Yarn PnP
 */
export const resolvedReact = async (existing: Record<string, unknown> = {}) => {
  try {
    return {
      ...existing,
      react: resolvePackageDir('react'),
      reactDom: resolvePackageDir('react-dom'),
    };
  } catch {
    return existing;
  }
};
