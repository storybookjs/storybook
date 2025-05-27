import { promises as fs } from 'node:fs';

import { cleanLog } from '../../../lib/cli-storybook/src/automigrate/helpers/cleanLog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Metadata = Record<string, any>;
export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug' | 'task' | 'prompt';
  message: string;
  metadata?: Metadata;
}

class LogTracker {
  private logs: LogEntry[] = [];

  addLog(level: LogEntry['level'], message: string, metadata?: Metadata) {
    this.logs.push({
      timestamp: new Date(),
      level,
      message: cleanLog(message),
      metadata,
    });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  async writeToFile(filePath: string): Promise<void> {
    const logContent = this.logs
      .map((log) => {
        const timestamp = log.timestamp.toISOString();
        const metadata = log.metadata ? ` ${JSON.stringify(log.metadata)}` : '';
        return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}${metadata}`;
      })
      .join('\n');

    await fs.writeFile(filePath, logContent, 'utf-8');
    this.logs = [];
  }

  clear(): void {
    this.logs = [];
  }
}

export const logTracker = new LogTracker();
