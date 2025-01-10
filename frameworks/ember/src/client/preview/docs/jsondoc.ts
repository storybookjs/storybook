/* eslint-disable no-underscore-dangle */
import { global } from '@storybook/global';

export const getJSONDoc = () => {
  return global.__EMBER_GENERATED_DOC_JSON__;
};

export const extractArgTypes = (componentName: string) => {
  const json = getJSONDoc();
  if (!(json && json.included)) {
    return null;
  }
  const componentDoc = json.included.find((doc: any) => doc.attributes.name === componentName);

  if (!componentDoc) {
    return null;
  }
  return componentDoc.attributes.arguments.reduce((acc: any, prop: any) => {
    acc[prop.name] = {
      name: prop.name,
      defaultValue: prop.defaultValue,
      description: prop.description,
      table: {
        defaultValue: { summary: prop.defaultValue },
        type: {
          summary: prop.type,
          required: prop.tags.length
            ? prop.tags.some((tag: any) => tag.name === 'required')
            : false,
        },
      },
    };
    return acc;
  }, {});
};

export const extractComponentDescription = (componentName: string) => {
  const json = getJSONDoc();
  if (!(json && json.included)) {
    return null;
  }
  const componentDoc = json.included.find((doc: any) => doc.attributes.name === componentName);

  if (!componentDoc) {
    return null;
  }

  return componentDoc.attributes.description;
};
