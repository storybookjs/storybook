import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { cleanLog } from '../../../lib/cli-storybook/src/automigrate/helpers/cleanLog';
import type { LogLevel } from './logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Metadata = Record<string, any>;
export interface LogEntry {
  timestamp: Date;
  level: LogLevel | 'prompt';
  message: string;
  metadata?: Metadata;
}

class LogTracker {
  #logs: LogEntry[] = [];
  #logFilePath = '';
  #shouldWriteLogsToFile = false;

  constructor() {
    this.#logFilePath = join(process.cwd(), 'debug-storybook.log');
  }

  enableLogWriting(): void {
    this.#shouldWriteLogsToFile = true;
  }

  get shouldWriteLogsToFile(): boolean {
    return this.#shouldWriteLogsToFile;
  }

  get logFilePath(): string {
    return this.#logFilePath;
  }

  get logs(): LogEntry[] {
    return [...this.#logs];
  }

  addLog(level: LogEntry['level'], message: string, metadata?: Metadata) {
    this.#logs.push({
      timestamp: new Date(),
      level,
      message: cleanLog(message),
      metadata,
    });
  }

  clear(): void {
    this.#logs = [];
  }

  async writeToFile(filePath: string = this.#logFilePath): Promise<string> {
    const logContent = this.#logs
      .map((log) => {
        const timestamp = log.timestamp.toISOString().split('T')[1].slice(0, -1);
        const metadata = log.metadata ? ` ${JSON.stringify(log.metadata)}` : '';
        return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}${metadata}`;
      })
      .join('\n');

    await fs.writeFile(filePath, logContent, 'utf-8');
    this.#logs = [];

    return filePath;
  }
}

export const logTracker = new LogTracker();
