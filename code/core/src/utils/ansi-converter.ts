import AnsiToHtml from 'ansi-to-html';

/** Converts text with ANSI escape codes to HTML. */
export interface AnsiConverter {
  toHtml(input: string): string;
}

/** Options of {@link createAnsiConverter}. */
export interface AnsiConverterOptions {
  /** Escape `<`, `>` and `&` in the input. */
  escapeXML?: boolean;
  /** Default foreground color. */
  fg?: string;
  /** Default background color. */
  bg?: string;
}

/** Lives in core so the interactions panel shares core's bundled converter instead of its own. */
export function createAnsiConverter(options: AnsiConverterOptions): AnsiConverter {
  return new AnsiToHtml(options);
}
