import type { ArgTypes, SBType } from '@storybook/csf';

export function extractSeededRequiredArgs(argTypes: ArgTypes) {
  const extractedArgTypes = Object.keys(argTypes).reduce(
    (acc, key: keyof typeof argTypes) => {
      const argType = argTypes[key];

      if (typeof argType.control === 'object' && 'type' in argType.control) {
        switch (argType.control.type) {
          case 'object':
            acc[key] = {};
            break;
          case 'inline-radio':
          case 'radio':
          case 'inline-check':
          case 'check':
          case 'select':
          case 'multi-select':
            acc[key] = argType.control.options?.[0];
            break;
          case 'color':
            acc[key] = '#000000';
            break;
          default:
            break;
        }
      }

      // @ts-expect-error (non strict)
      setArgType(argType.type, acc, key);
      return acc;
    },
    {} as Record<string, any>
  );
  return extractedArgTypes;
}

function setArgType(
  type: 'string' | 'number' | 'boolean' | 'symbol' | 'function' | SBType,
  obj: Record<string, any>,
  objKey: string | number
) {
  if (typeof type === 'string' || !type.required) {
    return;
  }

  switch (type.name) {
    case 'boolean':
      obj[objKey] = true;
      break;
    case 'number':
      obj[objKey] = 0;
      break;
    case 'string':
      obj[objKey] = objKey;
      break;
    case 'array':
      obj[objKey] = [];
      break;
    case 'object':
      obj[objKey] = {};
      Object.entries(type.value ?? {}).forEach(([typeKey, typeVal]) => {
        setArgType(typeVal, obj[objKey], typeKey);
      });
      break;
    case 'function':
      obj[objKey] = () => {};
      break;
    case 'intersection':
      if (type.value?.every((v) => v.name === 'object')) {
        obj[objKey] = {};
        type.value?.forEach((typeVal) => {
          if (typeVal.name === 'object') {
            Object.entries(typeVal.value ?? {}).forEach(([typeValKey, typeValVal]) => {
              setArgType(typeValVal, obj[objKey], typeValKey);
            });
          }
        });
      }
      break;
    case 'union':
      if (type.value?.[0] !== undefined) {
        setArgType(type.value[0], obj, objKey);
      }
      break;

    case 'enum':
      if (type.value?.[0] !== undefined) {
        obj[objKey] = type.value?.[0];
      }
      break;

    case 'other':
      if (typeof type.value === 'string' && type.value === 'tuple') {
        obj[objKey] = [];
      }
      break;
    default:
      break;
  }
}

export async function trySelectNewStory(
  selectStory: (id: string) => Promise<void> | void,
  storyId: string,
  attempt = 1
): Promise<void> {
  if (attempt > 10) {
    throw new Error('We could not select the new story. Please try again.');
  }

  try {
    await selectStory(storyId);
  } catch (e) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return trySelectNewStory(selectStory, storyId, attempt + 1);
  }
}
