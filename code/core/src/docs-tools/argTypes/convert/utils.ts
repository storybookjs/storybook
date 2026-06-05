export const NULLISH_VALUES = ['null', 'undefined', 'void'];
export const RADIO_CONTROL_THRESHOLD = 5;

export function normalizeLiteralUnion(values: string[]): any[] {
  const cleaned = values
    .map((val) => val.trim().replace(/^['"]|['"]$/g, ''))
    .filter((val) => !NULLISH_VALUES.includes(val));

  return cleaned.map((val) => {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  });
}
