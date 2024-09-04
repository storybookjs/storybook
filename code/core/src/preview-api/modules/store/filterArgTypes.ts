import type { StrictArgTypes } from '@storybook/core/types';

import pickBy from 'lodash/pickBy.js';

export type PropDescriptor = string[] | RegExp;

const matches = (name: string, descriptor: PropDescriptor) =>
  Array.isArray(descriptor) ? descriptor.includes(name) : name.match(descriptor);

export const filterArgTypes = (
  argTypes: StrictArgTypes,
  include?: PropDescriptor,
  exclude?: PropDescriptor
) => {
  if (!include && !exclude) {
    return argTypes;
  }
  return (
    argTypes &&
    pickBy(argTypes, (argType, key) => {
      const name = argType.name || key;
      return (!include || matches(name, include)) && (!exclude || !matches(name, exclude));
    })
  );
};
