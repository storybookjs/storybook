const QUOTE_REGEX = /^['"]|['"]$/g;
export const trimQuotes = (str: string) => str.replace(QUOTE_REGEX, '');
export const includesQuotes = (str: string) => QUOTE_REGEX.test(str);
export const parseLiteral = (str: string) => {
  const trimmedValue = trimQuotes(str);

  // Handle special literal values
  if (trimmedValue === 'null') {
    return null;
  }
  if (trimmedValue === 'undefined') {
    return undefined;
  }
  if (trimmedValue === 'true') {
    return true;
  }
  if (trimmedValue === 'false') {
    return false;
  }

  return includesQuotes(str) || Number.isNaN(Number(trimmedValue))
    ? trimmedValue
    : Number(trimmedValue);
};
