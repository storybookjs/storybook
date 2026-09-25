import { logger } from 'storybook/internal/client-logger';

import { getCustomElements, isValidComponent, isValidMetaData } from '..';
import type { CustomElementsItem } from './custom-elements-manifest-types.ts';
import { mapArgTypes } from './map-arg-types.ts';

interface Tag {
  name: string;
  description: string;
  attributes?: CustomElementsItem[];
  properties?: CustomElementsItem[];
  events?: CustomElementsItem[];
  methods?: CustomElementsItem[];
  members?: CustomElementsItem[];
  slots?: CustomElementsItem[];
  cssProperties?: CustomElementsItem[];
  cssParts?: CustomElementsItem[];
}

interface CustomElements {
  tags: Tag[];
  modules?: [];
}

interface Module {
  declarations?: [];
  exports?: [];
}

interface Declaration {
  tagName: string;
}

const getMetaDataExperimental = (tagName: string, customElements: CustomElements) => {
  if (!isValidComponent(tagName) || !isValidMetaData(customElements)) {
    return null;
  }
  const metaData = customElements.tags.find(
    (tag) => tag.name.toUpperCase() === tagName.toUpperCase()
  );
  if (!metaData) {
    logger.warn(`Component not found in custom-elements.json: ${tagName}`);
  }
  return metaData;
};

const getMetaDataV1 = (tagName: string, customElements: CustomElements) => {
  if (!isValidComponent(tagName) || !isValidMetaData(customElements)) {
    return null;
  }

  let metadata;
  customElements?.modules?.forEach((_module: Module) => {
    _module?.declarations?.forEach((declaration: Declaration) => {
      if (declaration.tagName === tagName) {
        metadata = declaration;
      }
    });
  });

  if (!metadata) {
    logger.warn(`Component not found in custom-elements.json: ${tagName}`);
  }
  return metadata;
};

const getMetaData = (tagName: string, manifest: any) => {
  if (manifest?.version === 'experimental') {
    return getMetaDataExperimental(tagName, manifest);
  }
  return getMetaDataV1(tagName, manifest);
};

export const extractArgTypesFromElements = (tagName: string, customElements: CustomElements) => {
  const metaData = getMetaData(tagName, customElements);
  return metaData && mapArgTypes(metaData);
};

export const extractArgTypes = (tagName: string) => {
  const cem = getCustomElements();
  return extractArgTypesFromElements(tagName, cem);
};

export const extractComponentDescription = (tagName: string) => {
  const metaData = getMetaData(tagName, getCustomElements());
  return metaData && metaData.description;
};
