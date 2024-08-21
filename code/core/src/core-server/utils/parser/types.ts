export type ParserResult = {
  exports: Array<{
    name: string;
    default: boolean;
  }>;
};

/** A parser that can parse the exports of a file */
export interface Parser {
  /**
   * Parse the content of a file and return the exports
   *
   * @param content The content of the file
   * @returns The result of the parsing. Contains the exports of the file
   */
  parse: (content: string) => Promise<ParserResult>;
}
