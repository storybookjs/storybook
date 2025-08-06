/**
 * Utility functions for detecting Angular signals, particularly query signals like
 * contentChildren(), viewChildren(), etc.
 */

/**
 * Determines if a given value is an Angular signal function.
 * Angular signals are functions that should not be overwritten during property assignment.
 * 
 * @param value - The value to check
 * @returns true if the value is an Angular signal, false otherwise
 */
export function isAngularSignal(value: any): boolean {
  // Must be a function
  if (typeof value !== 'function') {
    return false;
  }

  // Angular signals have specific constructor names or internal markers
  const constructorName = value?.constructor?.name;
  
  if (constructorName) {
    // Check for common Angular signal constructor patterns
    const signalPatterns = [
      'Signal',
      'QuerySignal', 
      'ContentChildrenQueryImpl',
      'ViewChildrenQueryImpl',
      'ContentChildQueryImpl',
      'ViewChildQueryImpl'
    ];
    
    if (signalPatterns.some(pattern => constructorName.includes(pattern))) {
      return true;
    }
  }

  // Check for Angular internal signal markers
  // These are properties that Angular uses internally to mark signals
  return !!(
    value['ɵsignal'] ||  // Internal signal marker in newer Angular versions
    value['__isSignal'] ||  // Potential signal marker
    value['ɵquerySignal'] ||  // Query signal marker
    (value._signal !== undefined) ||  // Signal reference property
    // Additional check for function that behaves like a signal
    (typeof value === 'function' && value.constructor && 
     value.toString().includes('[object Signal]'))
  );
}

/**
 * Safely assigns properties to a target object, preserving Angular signals.
 * This function replaces Object.assign() to avoid overwriting signal functions.
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

    // If the existing value is an Angular signal, don't overwrite it
    if (isAngularSignal(existingValue)) {
      // Skip assignment to preserve the signal function
      return;
    }

    // Safe to assign the new value
    target[key] = newValue;
  });
}