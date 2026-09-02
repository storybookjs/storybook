const ANSI = /\x1b\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

/** Length of `text` as the terminal renders it, with ANSI escapes stripped. */
export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}
