import { createColors } from 'picocolors';

// Not the picocolors default detection: that turns styling on under CI, and
// these strings land in archived eval logs and result artifacts, which must
// stay plain text. Style only a real terminal, honoring NO_COLOR
// (https://no-color.org).
const pc = createColors(process.stdout.isTTY === true && process.env.NO_COLOR === undefined);

export const { bold, dim, red, green, yellow, cyan } = pc;

const ANSI = /\x1b\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

/** Length of `text` as the terminal renders it, with ANSI escapes stripped. */
export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}
