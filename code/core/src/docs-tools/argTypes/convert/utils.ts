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
// throughout CSSProperties and similar library types). The regexes are anchored to
// whole members: an unanchored match would also fire on `Array<string & {}>` or
// `mystring & {}`, which do not accept arbitrary strings.
const OPEN_STRING_MEMBER = /^\s*\(?\s*string\s*&\s*\{\s*\}\s*\)?\s*$/;
const OPEN_STRING_MEMBER_PARENTHESIZED = /^\s*\(\s*string\s*&\s*\{\s*\}\s*\)\s*$/;
export const isOpenStringMember = (text: string) => OPEN_STRING_MEMBER.test(text);
export const isParenthesizedOpenStringMember = (text: string) =>
  OPEN_STRING_MEMBER_PARENTHESIZED.test(text);
export const isStringLiteralValue = (value: string) => /^['"]/.test(value);

// Splits a union type's raw text into top-level members. `|` inside parens,
// generics, object literals or tuples does not split the union.
export const splitTopLevelUnionMembers = (raw: string): string[] => {
  const members: string[] = [];
  let depth = 0;
  let current = '';
  let previous = '';
  for (const char of raw) {
    if ('([{<'.includes(char)) {
      depth += 1;
    } else if (')]}'.includes(char) || (char === '>' && previous !== '=')) {
      // `=>` in arrow types is not a closing generic bracket.
      depth -= 1;
    }
    if (char === '|' && depth === 0) {
      members.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    previous = char;
  }
  if (current.trim().length > 0) {
    members.push(current.trim());
  }
  return members;
};
