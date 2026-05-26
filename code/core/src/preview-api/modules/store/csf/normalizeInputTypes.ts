import type {
  ArgTypes,
  InputType,
  StrictArgTypes,
  StrictInputType,
} from 'storybook/internal/types';

import { mapValues } from 'es-toolkit/object';

type ControlWithOptions = Exclude<InputType['control'], string | false | undefined> & {
  options?: InputType['options'] | Record<string, any>;
};
type OptionsInput = Pick<InputType, 'control' | 'options' | 'mapping'>;
type NormalizedOptions = Pick<InputType, 'options' | 'mapping'>;

const getControlOptions = (control: InputType['control']) =>
  control && typeof control === 'object' ? (control as ControlWithOptions).options : undefined;

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

const normalizeOptions = ({ control, options, mapping }: OptionsInput): NormalizedOptions => {
  const inputOptions = options ?? getControlOptions(control);

  if (!inputOptions || Array.isArray(inputOptions)) {
    return {
      ...(inputOptions && { options: inputOptions }),
      ...(mapping && { mapping }),
    };
  }

  return {
    options: Object.keys(inputOptions),
    mapping: mapping ?? inputOptions,
  };
};

export const normalizeInputType = (inputType: InputType, key: string): StrictInputType => {
  const { type, control, options, mapping, ...rest } = inputType;
  const controlOptions = getControlOptions(control);
  const hasOptions = options !== undefined || controlOptions !== undefined;
  const normalized: StrictInputType = {
    name: key,
    ...rest,
    ...normalizeOptions({ control, options, mapping }),
  };

  if (type) {
    normalized.type = normalizeType(type);
  }
  if (control) {
    const normalizedControl = normalizeControl(control);
    if (normalizedControl && typeof normalizedControl === 'object') {
      const controlWithoutOptions = { ...normalizedControl } as ControlWithOptions;
      delete controlWithoutOptions.options;
      normalized.control =
        hasOptions && !controlWithoutOptions.type
          ? {
              type: 'select',
              ...controlWithoutOptions,
              ...(!('disable' in controlWithoutOptions) && { disable: false }),
            }
          : controlWithoutOptions;
    } else {
      normalized.control = normalizedControl;
    }
  } else if (control === false) {
    normalized.control = { disable: true };
  }
  return normalized;
};

export const normalizeInputTypes = (inputTypes: ArgTypes): StrictArgTypes =>
  mapValues(inputTypes, normalizeInputType);
