const QUOTE_REGEX = /^['"]|['"]$/g;
export const trimQuotes = (str: string) => str.replace(QUOTE_REGEX, '');
export const includesQuotes = (str: string) => QUOTE_REGEX.test(str);
export const parseLiteral = (str: string) => {
  const trimmedValue = trimQuotes(str);

  return includesQuotes(str) || Number.isNaN(Number(trimmedValue))
    ? trimmedValue
    : Number(trimmedValue);
};

// `string & {}` is the TypeScript idiom for "literal hints plus any string" (used
// throughout CSSProperties and similar library types). Non-global regex: a global
// one would leak `lastIndex` state between `.test` calls.
const OPEN_STRING_IDIOM = /string\s*&\s*\{\s*\}/;
export const isOpenStringIdiom = (raw: string) => OPEN_STRING_IDIOM.test(raw);
export const countOpenStringIdioms = (raw: string) =>
  (raw.match(/string\s*&\s*\{\s*\}/g) ?? []).length;
export const isStringLiteralValue = (value: string) => /^['"]/.test(value);
