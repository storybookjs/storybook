import type { ModuleExports, NormalizedProjectAnnotations } from '@storybook/core/types';
import type { Renderer } from '@storybook/core/types';
import { global } from '@storybook/global';

import { combineParameters } from '../parameters';
import { composeBeforeAllHooks } from './beforeAll';
import { normalizeArrays } from './normalizeArrays';
import { composeStepRunners } from './stepRunners';

export function getField<TFieldType = any>(
  moduleExportList: ModuleExports[],
  field: string
): TFieldType | TFieldType[] {
  return moduleExportList.map((xs) => xs.default?.[field] ?? xs[field]).filter(Boolean);
}

export function getArrayField<TFieldType = any>(
  moduleExportList: ModuleExports[],
  field: string,
  options: { reverseFileOrder?: boolean } = {}
): TFieldType[] {
  return getField(moduleExportList, field).reduce((prev: any, cur: any) => {
    const normalized = normalizeArrays(cur);
    return options.reverseFileOrder ? [...normalized, ...prev] : [...prev, ...normalized];
  }, []);
}

export function getObjectField<TFieldType = Record<string, any>>(
  moduleExportList: ModuleExports[],
  field: string
): TFieldType {
  return Object.assign({}, ...getField(moduleExportList, field));
}

export function getSingletonField<TFieldType = any>(
  moduleExportList: ModuleExports[],
  field: string
): TFieldType {
  return getField(moduleExportList, field).pop();
}

export function composeConfigs<TRenderer extends Renderer>(
  moduleExportList: ModuleExports[]
): NormalizedProjectAnnotations<TRenderer> {
  const allArgTypeEnhancers = getArrayField(moduleExportList, 'argTypesEnhancers');
  const stepRunners = getField(moduleExportList, 'runStep');
  const beforeAllHooks = getArrayField(moduleExportList, 'beforeAll');

  return {
    parameters: combineParameters(...getField(moduleExportList, 'parameters')),
    decorators: getArrayField(moduleExportList, 'decorators', {
      reverseFileOrder: !(global.FEATURES?.legacyDecoratorFileOrder ?? false),
    }),
    args: getObjectField(moduleExportList, 'args'),
    argsEnhancers: getArrayField(moduleExportList, 'argsEnhancers'),
    argTypes: getObjectField(moduleExportList, 'argTypes'),
    argTypesEnhancers: [
      ...allArgTypeEnhancers.filter((e) => !e.secondPass),
      ...allArgTypeEnhancers.filter((e) => e.secondPass),
    ],
    globals: getObjectField(moduleExportList, 'globals'),
    initialGlobals: getObjectField(moduleExportList, 'initialGlobals'),
    globalTypes: getObjectField(moduleExportList, 'globalTypes'),
    loaders: getArrayField(moduleExportList, 'loaders'),
    beforeAll: composeBeforeAllHooks(beforeAllHooks),
    beforeEach: getArrayField(moduleExportList, 'beforeEach'),
    render: getSingletonField(moduleExportList, 'render'),
    renderToCanvas: getSingletonField(moduleExportList, 'renderToCanvas'),
    renderToDOM: getSingletonField(moduleExportList, 'renderToDOM'), // deprecated
    applyDecorators: getSingletonField(moduleExportList, 'applyDecorators'),
    runStep: composeStepRunners<TRenderer>(stepRunners),
    tags: getArrayField(moduleExportList, 'tags'),
    mount: getSingletonField(moduleExportList, 'mount'),
    testingLibraryRender: getSingletonField(moduleExportList, 'testingLibraryRender'),
  };
}
