const QUOTE_REGEX = /^['"]|['"]$/g;
export const trimQuotes = (str: string): string => str.replace(QUOTE_REGEX, '');
export const includesQuotes = (str: string): boolean => QUOTE_REGEX.test(str);
export const parseLiteral = (str: string): string | number => {
  const trimmedValue = trimQuotes(str);

  return includesQuotes(str) || Number.isNaN(Number(trimmedValue))
    ? trimmedValue
    : Number(trimmedValue);
};
