import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import type { LogLevel } from './logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Metadata = Record<string, any>;
export interface LogEntry {
  timestamp: Date;
  level: LogLevel | 'prompt';
  message: string;
  metadata?: Metadata;
}

const DEBUG_LOG_FILE_NAME = 'debug-storybook.log';
const DEFAULT_LOG_FILE_PATH = join(process.cwd(), DEBUG_LOG_FILE_NAME);

/**
 * Tracks and manages logs for Storybook CLI operations. Provides functionality to collect, store
 * and write logs to a file.
 */
class LogTracker {
  /** Array to store log entries */
  #logs: LogEntry[] = [];
  /**
   * Flag indicating if logs should be written to file it is enabled either by users providing the
   * `--logfile` flag to a CLI command or when we explicitly enable it by calling
   * `logTracker.enableLogWriting()` e.g. in automigrate or doctor command when there are issues
   */
  #shouldWriteLogsToFile = false;

  /** Enables writing logs to file. */
  enableLogWriting(): void {
    this.#shouldWriteLogsToFile = true;
  }

  /** Returns whether logs should be written to file. */
  get shouldWriteLogsToFile(): boolean {
    return this.#shouldWriteLogsToFile;
  }

  /** Returns a copy of all stored logs. */
  get logs(): LogEntry[] {
    return [...this.#logs];
  }

  /**
   * Adds a new log entry.
   *
   * @param level - The log level
   * @param message - The log message
   * @param metadata - Optional metadata to attach to the log, can be any JSON serializable value
   */
  addLog(level: LogEntry['level'], message: string, metadata?: Metadata) {
    this.#logs.push({
      timestamp: new Date(),
      level,
      message,
      metadata,
    });
  }

  /** Clears all stored logs. */
  clear(): void {
    this.#logs = [];
  }

  /**
   * Writes all stored logs to a file and clears the log store.
   *
   * @param filePath - Optional custom file path to write logs to
   * @returns The path where logs were written, by default is debug-storybook.log in current working
   *   directory
   */
  async writeToFile(filePath: string | boolean | undefined): Promise<string> {
    const logFilePath = typeof filePath === 'string' ? filePath : DEFAULT_LOG_FILE_PATH;

    const logContent = this.#logs
      .map((log) => {
        const timestamp =
          log.timestamp.toLocaleTimeString('en-US', { hour12: false }) +
          `.${log.timestamp.getMilliseconds().toString().padStart(3, '0')}`;
        const metadata = log.metadata ? ` ${JSON.stringify(log.metadata)}` : '';
        return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}${metadata}`;
      })
      .join('\n');

    await fs.writeFile(logFilePath, logContent, 'utf-8');
    this.#logs = [];

    return logFilePath;
  }
}

export const logTracker = new LogTracker();
