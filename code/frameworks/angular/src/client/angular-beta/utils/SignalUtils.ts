/**
 * Utility functions for safely handling property assignment in Angular components,
 * particularly to preserve Angular signal functions like contentChildren(), viewChildren(), etc.
 */

/**
 * Determines if a given value is likely an Angular signal or other function that should be preserved.
 * Uses a conservative approach: any function should be preserved when being overwritten by non-functions.
 * 
 * @param existingValue - The current value on the target object
 * @param newValue - The new value being assigned
 * @returns true if the existing value should be preserved, false otherwise
 */
export function shouldPreserveExistingValue(existingValue: any, newValue: any): boolean {
  // If the existing value is a function and the new value is not a function,
  // preserve the existing function to avoid breaking Angular signals
  if (typeof existingValue === 'function' && typeof newValue !== 'function') {
    return true;
  }

  // For additional safety, also preserve functions when new value is an array
  // This specifically handles the contentChildren -> array assignment case
  if (typeof existingValue === 'function' && Array.isArray(newValue)) {
    return true;
  }

  return false;
}

/**
 * Safely assigns properties to a target object, preserving Angular signal functions.
 * This function replaces Object.assign() to avoid overwriting function properties
 * with non-function values, which is particularly important for Angular signals.
 * 
 * @param target - The target object to assign properties to
 * @param source - The source object containing properties to assign
 */
export function safeAssignProperties(target: any, source: any): void {
  if (!source || !target) {
    return;
  }

  Object.keys(source).forEach(key => {
    const existingValue = target[key];
    const newValue = source[key];

    // Preserve existing functions when new value is not a function
    if (shouldPreserveExistingValue(existingValue, newValue)) {
      // Log when we preserve a function for debugging
      if (typeof console !== 'undefined' && console.debug) {
        console.debug(`[SignalUtils] Preserving function property '${key}' (likely Angular signal)`, {
          existingType: typeof existingValue,
          existingConstructor: existingValue?.constructor?.name,
          newValueType: typeof newValue,
          newValue: Array.isArray(newValue) ? `Array(${newValue.length})` : newValue
        });
      }
      // Skip assignment to preserve the function
      return;
    }

    // Safe to assign the new value
    target[key] = newValue;
  });
}