// Minimal ANSI styling for console output, in place of a color dependency.
//
// Styling is disabled when the output is not a terminal or when NO_COLOR is
// set (https://no-color.org), so piped and CI output stays plain text.

const enabled = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

function style(open: number, close: number): (text: string) => string {
  if (!enabled) {
    return (text) => text;
  }
  return (text) => `\x1b[${open}m${text}\x1b[${close}m`;
}

export const bold = style(1, 22);
export const dim = style(2, 22);
export const red = style(31, 39);
export const green = style(32, 39);
export const yellow = style(33, 39);
export const cyan = style(36, 39);

/** Length of `text` as the terminal renders it, with ANSI escapes stripped. */
export function visibleLength(text: string): number {
  return text.replace(/\x1b\[[0-9;]*m/g, '').length;
}
