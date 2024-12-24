import { logger } from '@storybook/core/client-logger';

import { isEqual, mergeWith, omitBy, pick } from 'es-toolkit';

export default <TObj = any>(a: TObj, ...b: Partial<TObj>[]): TObj => {
  // start with empty object
  let target = {};

  // merge object a unto target
  target = mergeWith({}, a, (objValue: TObj, srcValue: Partial<TObj>) => {
    if (Array.isArray(srcValue) && Array.isArray(objValue)) {
      srcValue.forEach((s) => {
        const existing = objValue.find((o) => o === s || isEqual(o, s));
        if (!existing) {
          objValue.push(s);
        }
      });

      return objValue;
    }
    if (Array.isArray(objValue)) {
      logger.log(['the types mismatch, picking', objValue]);
      return objValue;
    }
  });

  for (const obj of b) {
    // merge object b unto target
    target = mergeWith(target, obj, (objValue: TObj, srcValue: Partial<TObj>) => {
      if (Array.isArray(srcValue) && Array.isArray(objValue)) {
        srcValue.forEach((s) => {
          const existing = objValue.find((o) => o === s || isEqual(o, s));
          if (!existing) {
            objValue.push(s);
          }
        });

        return objValue;
      }
      if (Array.isArray(objValue)) {
        logger.log(['the types mismatch, picking', objValue]);
        return objValue;
      }
    });
  }

  return target as TObj;
};

export const noArrayMerge = <TObj = any>(a: TObj, ...b: Partial<TObj>[]): TObj => {
  // start with empty object
  let target = {};

  // merge object a unto target
  target = mergeWith({}, a, (objValue: TObj, srcValue: Partial<TObj>) => {
    // Treat arrays as scalars:
    if (Array.isArray(srcValue)) {
      return srcValue;
    }
  });

  for (const obj of b) {
    // merge object b unto target
    target = mergeWith(target, obj, (objValue: TObj, srcValue: Partial<TObj>) => {
      // Treat arrays as scalars:
      if (Array.isArray(srcValue)) {
        return srcValue;
      }
    });
  }

  return target as TObj;
};
