import type {
  ArgTypes,
  InputType,
  StrictArgTypes,
  StrictInputType,
} from 'storybook/internal/types';

import { mapValues } from 'es-toolkit/object';

const normalizeType = (type: InputType['type']): StrictInputType['type'] => {
  return typeof type === 'string' ? { name: type } : type;
};

const normalizeControl = (control: InputType['control']): StrictInputType['control'] => {
  if (typeof control === 'string') {
    // When explicitly setting a control type, ensure disable is false to override
    // any inherited disable: true from parent argTypes (fixes #27091)
    return { type: control, disable: false };
  }
  // If control is an object with a type but no explicit disable, set disable: false
  // to ensure it overrides any inherited disable: true
  if (control && typeof control === 'object' && 'type' in control && !('disable' in control)) {
    return { ...control, disable: false };
  }
  return control;
};

export const normalizeInputType = (inputType: InputType, key: string): StrictInputType => {
  const { type, control, ...rest } = inputType;
  const normalized: StrictInputType = {
    name: key,
    ...rest,
  };

  if (type) {
    normalized.type = normalizeType(type);
  }
  if (control) {
    normalized.control = normalizeControl(control);
  } else if (control === false) {
    normalized.control = { disable: true };
  }
  return normalized;
};

export const normalizeInputTypes = (inputTypes: ArgTypes): StrictArgTypes =>
  mapValues(inputTypes, normalizeInputType);
