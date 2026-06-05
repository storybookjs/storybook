export type ControlType = 'radio' | 'select' | 'object';

export const normalizeUnionValue = (value: string): string => 
  value.replace(/['"]/g, '').trim();

export const filterAuxiliaryTypes = (values: string[]): string[] => 
  values.filter(val => !['null', 'undefined', 'void'].includes(val.toLowerCase()));

export const determineControlType = (values: string[]): ControlType => {
  if (values.length === 0) return 'object';
  return values.length <= 5 ? 'radio' : 'select';
};

export const inferUnionControl = (unionString: string) => {
  const rawValues = unionString.split('|');
  const cleanedValues = filterAuxiliaryTypes(rawValues.map(normalizeUnionValue));
  
  return {
    values: cleanedValues,
    control: determineControlType(cleanedValues),
  };
};
