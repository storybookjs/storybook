import type { DocgenInfo } from '../docgen/types';
import type { TSType } from './typescript';
import { convert as tsConvert } from './typescript';
import type { FlowType } from './flow';
import { convert as flowConvert } from './flow';
import { convert as propTypesConvert } from './proptypes';

export const convert = (docgenInfo: DocgenInfo) => {
  const { type, tsType, flowType } = docgenInfo;
  try {
    if (type != null) return propTypesConvert(type);
    if (tsType != null) return tsConvert(tsType as TSType);
    if (flowType != null) return flowConvert(flowType as FlowType);
  } catch (err) {
    // if we can't convert the type, we'll just return null to fallback to a simple summary, and provide the error to the user
    console.error(err);
  }

  return null;
};
