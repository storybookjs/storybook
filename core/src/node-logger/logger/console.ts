import picocolors from 'picocolors';

import { debug, error, log, warn } from './logger';

interface ConsoleLoggerOptions {
  prefix: string;
  color:
    | 'bgBlack'
    | 'bgRed'
    | 'bgGreen'
    | 'bgYellow'
    | 'bgBlue'
    | 'bgMagenta'
    | 'bgCyan'
    | 'bgWhite'
    | 'bgBlackBright'
    | 'bgRedBright'
    | 'bgGreenBright'
    | 'bgYellowBright'
    | 'bgBlueBright'
    | 'bgMagentaBright'
    | 'bgCyanBright'
    | 'bgWhiteBright';
}

class ConsoleLogger implements Console {
  Console = ConsoleLogger;

  protected timers = new Map<string, number>();
  protected counters = new Map<string, number>();
  protected lastStatusLine: string | null = null;
  protected statusLineCount = 0;

  // These will be overridden by child classes
  protected get prefix(): string {
    return '';
  }

  protected get color(): (text: string) => string {
    return (text: string) => text;
  }

  protected formatMessage(...data: any[]): string {
    const message = data.join(' ');
    return this.prefix ? `${this.color(this.prefix)} ${message}` : message;
  }

  assert(condition?: boolean, ...data: any[]): void {
    if (!condition) {
      error(this.formatMessage('Assertion failed:', ...data));
    }
  }

  // Needs some proper implementation
  // Take a look at https://github.com/webpack/webpack/blob/5f898719ae47b89bee3c126bf5d2e0081ea8c91f/lib/node/nodeConsole.js#L4
  // for some inspiration
  // status(...data: any[]): void {
  //   const message = this.formatMessage(...data);

  //   // If we have a previous status line, we need to clear it
  //   if (this.lastStatusLine !== null) {
  //     this.clearStatus();
  //   }

  //   // Write the status message directly to stdout without adding newlines
  //   process.stdout.write(message);

  //   // Update tracking variables
  //   this.lastStatusLine = message;
  //   this.statusLineCount = 1; // For now, assume single line status messages

  //   // If the message contains newlines, count them
  //   const newlineCount = (message.match(/\n/g) || []).length;
  //   this.statusLineCount = newlineCount + 1;
  // }

  // /** Clears the current status line if one exists */
  // clearStatus(): void {
  //   if (this.lastStatusLine !== null) {
  //     // Move cursor to the beginning of the current line
  //     process.stdout.write('\r');

  //     // Clear the current line
  //     process.stdout.clearLine(1);

  //     // Reset tracking variables
  //     this.lastStatusLine = null;
  //     this.statusLineCount = 0;
  //   }
  // }

  /**
   * The **`console.clear()`** static method clears the console if possible.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/clear_static)
   */
  clear(): void {
    // Clear the console by logging a clear sequence
    console.clear();
  }

  /**
   * The **`console.count()`** static method logs the number of times that this particular call to
   * `count()` has been called.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/count_static)
   */
  count(label?: string): void {
    const key = label || 'default';
    const currentCount = (this.counters.get(key) || 0) + 1;
    this.counters.set(key, currentCount);
    log(this.formatMessage(`${key}: ${currentCount}`));
  }

  /**
   * The **`console.countReset()`** static method resets counter used with console/count_static.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/countReset_static)
   */
  countReset(label?: string): void {
    const key = label || 'default';
    this.counters.delete(key);
  }

  /**
   * The **`console.debug()`** static method outputs a message to the console at the 'debug' log
   * level.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/debug_static)
   */
  debug(...data: any[]): void {
    process.stdout.write('\n'); // Add newline after clearing status
    debug(this.formatMessage(...data));
  }

  /**
   * The **`console.dir()`** static method displays a list of the properties of the specified
   * JavaScript object.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/dir_static)
   */
  dir(item?: any, options?: any): void {
    // TODO: Implement this with our own logger
    console.dir(item, options);
  }

  /**
   * The **`console.dirxml()`** static method displays an interactive tree of the descendant
   * elements of the specified XML/HTML element.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/dirxml_static)
   */
  dirxml(...data: any[]): void {
    // TODO: Implement this with our own logger
    console.dirxml(...data);
  }

  /**
   * The **`console.error()`** static method outputs a message to the console at the 'error' log
   * level.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/error_static)
   */
  error(...data: any[]): void {
    process.stdout.write('\n'); // Add newline after clearing status
    error(this.formatMessage(...data));
  }

  /**
   * The **`console.group()`** static method creates a new inline group in the Web console log,
   * causing any subsequent console messages to be indented by an additional level, until
   * console/groupEnd_static is called.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/group_static)
   */
  group(...data: any[]): void {
    // TODO: Implement this with our own logger
    console.group(...data);
  }

  /**
   * The **`console.groupCollapsed()`** static method creates a new inline group in the console.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/groupCollapsed_static)
   */
  groupCollapsed(...data: any[]): void {
    // TODO: Implement this with our own logger
    console.groupCollapsed(...data);
  }

  /**
   * The **`console.groupEnd()`** static method exits the current inline group in the console.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/groupEnd_static)
   */
  groupEnd(): void {
    // TODO: Implement this with our own logger
    console.groupEnd();
  }

  /**
   * The **`console.info()`** static method outputs a message to the console at the 'info' log
   * level.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/info_static)
   */
  info(...data: any[]): void {
    process.stdout.write('\n'); // Add newline after clearing status
    // "info" logger shouldn't be used in the console logger, because info should be reserved for important messages
    log(this.formatMessage(...data));
  }

  /**
   * The **`console.log()`** static method outputs a message to the console.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/log_static)
   */
  log(...data: any[]): void {
    process.stdout.write('\n'); // Add newline after clearing status
    log(this.formatMessage(...data));
  }

  /**
   * The **`console.table()`** static method displays tabular data as a table.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/table_static)
   */
  table(tabularData?: any, properties?: string[]): void {
    // TODO: Implement this with our own logger
    console.table(tabularData, properties);
  }

  /**
   * The **`console.time()`** static method starts a timer you can use to track how long an
   * operation takes.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/time_static)
   */
  time(label?: string): void {
    const key = label || 'default';
    // TODO: Implement this with our own logger
    this.timers.set(key, Date.now());
  }

  /**
   * The **`console.timeEnd()`** static method stops a timer that was previously started by calling
   * console/time_static.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/timeEnd_static)
   */
  timeEnd(label?: string): void {
    const key = label || 'default';
    const startTime = this.timers.get(key);
    if (startTime) {
      const duration = Date.now() - startTime;
      log(this.formatMessage(`${key}: ${duration}ms`));
      this.timers.delete(key);
    } else {
      warn(this.formatMessage(`Timer '${key}' does not exist`));
    }
  }

  /**
   * The **`console.timeLog()`** static method logs the current value of a timer that was previously
   * started by calling console/time_static.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/timeLog_static)
   */
  timeLog(label?: string, ...data: any[]): void {
    const key = label || 'default';
    const startTime = this.timers.get(key);
    if (startTime) {
      const duration = Date.now() - startTime;
      log(this.formatMessage(`${key}: ${duration}ms`, ...data));
    } else {
      warn(this.formatMessage(`Timer '${key}' does not exist`));
    }
  }

  timeStamp(label?: string): void {
    const timestamp = new Date().toISOString();
    log(this.formatMessage(`[${timestamp}]${label ? ` ${label}` : ''}`));
  }

  /**
   * The **`console.trace()`** static method outputs a stack trace to the console.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/trace_static)
   */
  trace(...data: any[]): void {
    // TODO: Implement this with our own logger
    console.trace(...data);
  }

  /**
   * The **`console.warn()`** static method outputs a warning message to the console at the
   * 'warning' log level.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/warn_static)
   */
  warn(...data: any[]): void {
    process.stdout.write('\n'); // Add newline after clearing status
    warn(this.formatMessage(...data));
  }

  profile(label?: string): void {
    // TODO: Implement this with our own logger
    console.profile(label);
    log(this.formatMessage(`Profile started: ${label}`));
  }

  profileEnd(label?: string): void {
    // TODO: Implement this with our own logger
    console.profileEnd(label);
    log(this.formatMessage(`Profile ended: ${label}`));
  }
}

// Extended ConsoleLogger with prefix and color functionality
class StyledConsoleLogger extends ConsoleLogger {
  private _prefix: string;
  private _color: ConsoleLoggerOptions['color'];

  constructor(options: ConsoleLoggerOptions) {
    super();
    this._prefix = options.prefix || '';
    this._color = options.color;
  }

  // Override the getter methods from parent class
  protected get prefix(): string {
    return this._prefix;
  }

  protected get color() {
    return picocolors[this._color];
  }
}

export { ConsoleLogger, StyledConsoleLogger };
