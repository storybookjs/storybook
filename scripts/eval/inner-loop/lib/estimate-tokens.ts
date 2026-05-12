/**
 * Mirror of @storybook/addon-mcp's `estimateTokens`. Whitespace and
 * alphanumeric runs each count as one token; every other char as one token.
 * Cheap approximation suitable for telemetry / cost projection.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let count = 0;
  let i = 0;
  const len = text.length;
  while (i < len) {
    const code = text.charCodeAt(i);
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      count++;
      i++;
      while (i < len) {
        const c = text.charCodeAt(i);
        if (!(c === 32 || c === 9 || c === 10 || c === 13)) break;
        i++;
      }
    } else if (
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      code === 95
    ) {
      count++;
      i++;
      while (i < len) {
        const c = text.charCodeAt(i);
        if (
          !(
            (c >= 48 && c <= 57) ||
            (c >= 65 && c <= 90) ||
            (c >= 97 && c <= 122) ||
            c === 95
          )
        )
          break;
        i++;
      }
    } else {
      count++;
      i++;
    }
  }
  return count;
}
