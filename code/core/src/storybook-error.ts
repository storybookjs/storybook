function parseErrorCode({
  code,
  category,
}: Pick<StorybookError, 'code' | 'category'>): `SB_${typeof category}_${string}` {
  const paddedCode = String(code).padStart(4, '0');
  return `SB_${category}_${paddedCode}`;
}

export abstract class StorybookError extends Error {
  /**
   * Category of the error. Used to classify the type of error, e.g., 'PREVIEW_API'.
   */
  public readonly category: string;

  /**
   * Code representing the error. Used to uniquely identify the error, e.g., 1.
   */
  public readonly code: number;

  /**
   * Data associated with the error. Used to provide additional information in the error message or to be passed to telemetry.
   */
  public readonly data = {};

  /**
   * Specifies the documentation for the error.
   * - If `true`, links to a documentation page on the Storybook website (make sure it exists before enabling) – This is not implemented yet.
   * - If a string, uses the provided URL for documentation (external or FAQ links).
   * - If `false` (default), no documentation link is added.
   */
  public readonly documentation: boolean | string | string[];

  /**
   * Flag used to easily determine if the error originates from Storybook.
   */
  readonly fromStorybook: true = true as const;

  get fullErrorCode() {
    return parseErrorCode({ code: this.code, category: this.category });
  }

  /**
   * Overrides the default `Error.name` property in the format: SB_<CATEGORY>_<CODE>.
   */
  get name() {
    const errorName = this.constructor.name;

    return `${this.fullErrorCode} (${errorName})`;
  }

  constructor(props: {
    category: string;
    code: number;
    message: string;
    documentation?: boolean | string | string[];
  }) {
    super(StorybookError.getFullMessage(props));
    this.category = props.category;
    this.documentation = props.documentation ?? false;
    this.code = props.code;
  }

  /**
   * Generates the error message along with additional documentation link (if applicable).
   */
  static getFullMessage({
    documentation,
    code,
    category,
    message,
  }: ConstructorParameters<typeof StorybookError>[0]) {
    let page: string | undefined;

    if (documentation === true) {
      page = `https://storybook.js.org/error/${parseErrorCode({ code, category })}`;
    } else if (typeof documentation === 'string') {
      page = documentation;
    } else if (Array.isArray(documentation)) {
      page = `\n${documentation.map((doc) => `\t- ${doc}`).join('\n')}`;
    }

    return `${message}${page != null ? `\n\nMore info: ${page}\n` : ''}`;
  }
}
