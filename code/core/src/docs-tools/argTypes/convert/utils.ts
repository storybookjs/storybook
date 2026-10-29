const QUOTE_REGEX = /^['"]|['"]$/g;
export const trimQuotes = (str: string) => str.replace(QUOTE_REGEX, '');
export const includesQuotes = (str: string) => QUOTE_REGEX.test(str);
export const parseLiteral = (str: string) => {
  const trimmedValue = trimQuotes(str);

  // Bare `true`/`false` source tokens are boolean literals and must survive as booleans —
  // otherwise selecting `false` in Controls passes the truthy string `"false"` to the
  // component. Quoted forms (`'"true"'`) stay strings; the leading quote marks a string
  // literal, and JSON.stringify'd enum members from the component-meta extractor follow
  // the same rule.
  if (!includesQuotes(str) && (trimmedValue === 'true' || trimmedValue === 'false')) {
    return trimmedValue === 'true';
  }

  return includesQuotes(str) || Number.isNaN(Number(trimmedValue))
    ? trimmedValue
    : Number(trimmedValue);
};
