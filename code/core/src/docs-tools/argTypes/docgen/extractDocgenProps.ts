import type { ExtractedJsDoc } from '../jsdocParser';
import { parseJsDoc } from '../jsdocParser';
import type { Component } from '../types';
import type { PropDefFactory } from './createPropDef';
import { getPropDefFactory } from './createPropDef';
import type { DocgenInfo, PropDef } from './types';
import { TypeSystem } from './types';
import { getDocgenDescription, getDocgenSection, isValidDocgenSection } from './utils';

export interface ExtractedProp {
  propDef: PropDef;
  docgenInfo: DocgenInfo;
  jsDocTags?: ExtractedJsDoc;
  typeSystem: TypeSystem;
}

export type ExtractProps = (component: Component, section: string) => ExtractedProp[];

const getTypeSystem = (docgenInfo: DocgenInfo): TypeSystem => {
  if (docgenInfo.type != null) {
    return TypeSystem.JAVASCRIPT;
  }

  if (docgenInfo.flowType != null) {
    return TypeSystem.FLOW;
  }

  if (docgenInfo.tsType != null) {
    return TypeSystem.TYPESCRIPT;
  }

  return TypeSystem.UNKNOWN;
};

export const extractComponentSectionArray = (docgenSection: any) => {
  const typeSystem = getTypeSystem(docgenSection[0]);
  const createPropDef = getPropDefFactory(typeSystem);

  return docgenSection.map((item: any) => {
    let sanitizedItem = item;
    if (item.type?.elements) {
      sanitizedItem = {
        ...item,
        type: {
          ...item.type,
          value: item.type.elements,
        },
      };
    }
    return extractProp(sanitizedItem.name, sanitizedItem, typeSystem, createPropDef);
  });
};

export const extractComponentSectionObject = (docgenSection: any) => {
  const docgenPropsKeys = Object.keys(docgenSection);
  const typeSystem = getTypeSystem(docgenSection[docgenPropsKeys[0]]);
  const createPropDef = getPropDefFactory(typeSystem);

  return docgenPropsKeys
    .map((propName) => {
      const docgenInfo = docgenSection[propName];

      return docgenInfo != null
        ? extractProp(propName, docgenInfo, typeSystem, createPropDef)
        : null;
    })
    .filter(Boolean);
};

export const extractComponentProps: ExtractProps = (component, section) => {
  const docgenSection = getDocgenSection(component, section);

  if (!isValidDocgenSection(docgenSection)) {
    return [];
  }

  // vue-docgen-api has diverged from react-docgen and returns an array
  return Array.isArray(docgenSection)
    ? extractComponentSectionArray(docgenSection)
    : extractComponentSectionObject(docgenSection);
};

function extractProp(
  propName: string,
  docgenInfo: DocgenInfo,
  typeSystem: TypeSystem,
  createPropDef: PropDefFactory
): ExtractedProp | null {
  const jsDocParsingResult = parseJsDoc(docgenInfo.description);
  const isIgnored = jsDocParsingResult.includesJsDoc && jsDocParsingResult.ignore;

  if (!isIgnored) {
    const propDef = createPropDef(propName, docgenInfo, jsDocParsingResult);

    return {
      propDef,
      jsDocTags: jsDocParsingResult.extractedTags,
      docgenInfo,
      typeSystem,
    };
  }

  return null;
}

export function extractComponentDescription(component?: Component): string {
  return component != null ? getDocgenDescription(component) : '';
}
