
/**
 * Escape special characters in a string to make it safe for use in JavaScript strings.
 */
export function safeJsString(str: string): string {
  return str.replace(/['"\\\b\f\n\r\t]/g, (char) => {
    const codes: Record<string, string> = {
      "'": "\\'",
      '"': '\\"',
      "\\": "\\\\",
      "\n": "\\n",
      "\r": "\\r"
    };
    return codes[char] || char;
  });
}