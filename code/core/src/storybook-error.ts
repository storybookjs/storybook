function parseErrorCode({
  code,
  category,
}: Pick<StorybookError, 'code' | 'category'>): `SB_${typeof category}_${string}` {
  const paddedCode = String(code).padStart(4, '0');
  return `SB_${category}_${paddedCode}`;
}

export function appendErrorRef(url: string): string {
  // Skip if not storybook.js.org OR already has ref=error
  if (/^(?!.*storybook\.js\.org)|[?&]ref=error\b/.test(url)) {
    return url;
  }

  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set('ref', 'error');
    return urlObj.toString();
  } catch {
    // Fallback for invalid URLs - return as-is
    return url;
  }
}

export abstract class StorybookError extends Error {
  private _name: string | undefined;

  /** Category of the error. Used to classify the type of error, e.g., 'PREVIEW_API'. */
  public readonly category: string;

  /** Code representing the error. Used to uniquely identify the error, e.g., 1. */
  public readonly code: number;

  /**
   * Data associated with the error. Used to provide additional information in the error message or
   * to be passed to telemetry.
   */
  public readonly data = {};

  /**
   * Specifies the documentation for the error.
   *
   * - If `true`, links to a documentation page on the Storybook website (make sure it exists before
   *   enabling) – This is not implemented yet.
   * - If a string, uses the provided URL for documentation (external or FAQ links).
   * - If `false` (default), no documentation link is added.
   */
  public readonly documentation: boolean | string | string[];

  /** Flag used to easily determine if the error originates from Storybook. */
  readonly fromStorybook: true = true as const;

  /**
   * Flag used to determine if the error is handled by us and should therefore not be shown to the
   * user.
   */
  public isHandledError = false;

  get fullErrorCode() {
    return parseErrorCode({ code: this.code, category: this.category });
  }

  /** Overrides the default `Error.name` property in the format: SB_<CATEGORY>_<CODE>. */
  get name() {
    const errorName = this._name || this.constructor.name;

    return `${this.fullErrorCode} (${errorName})`;
  }

  set name(name: string) {
    this._name = name;
  }

  constructor(props: {
    category: string;
    code: number;
    message: string;
    documentation?: boolean | string | string[];
    isHandledError?: boolean;
    name: string;
  }) {
    super(StorybookError.getFullMessage(props));
    this.category = props.category;
    this.documentation = props.documentation ?? false;
    this.code = props.code;
    this.isHandledError = props.isHandledError ?? false;
    this.name = props.name;
  }

  /** Generates the error message along with additional documentation link (if applicable). */
  static getFullMessage({
    documentation,
    code,
    category,
    message,
  }: ConstructorParameters<typeof StorybookError>[0]) {
    let page: string | undefined;

    if (documentation === true) {
      page = `https://storybook.js.org/error/${parseErrorCode({ code, category })}?ref=error`;
    } else if (typeof documentation === 'string') {
      page = appendErrorRef(documentation);
    } else if (Array.isArray(documentation)) {
      page = `\n${documentation.map((doc) => `\t- ${appendErrorRef(doc)}`).join('\n')}`;
    }

    return `${message}${page != null ? `\n\nMore info: ${page}\n` : ''}`;
  }
}
