export const RADIO_CONTROL_THRESHOLD = 5;

export const normalizeUnionLiterals = (unionString: string): string[] => {
  const NON_LITERAL_NOISE = ['undefined', 'null', 'void'];
  
  return unionString
    .split('|')
    .map((item) => item.trim().replace(/['"]/g, ''))
    .filter((item) => item !== '' && !NON_LITERAL_NOISE.includes(item));
};
