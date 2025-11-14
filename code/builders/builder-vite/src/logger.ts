import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

const seenWarnings = new Set<string>();

export async function createViteLogger() {
  const { createLogger } = await import('vite');

  const customViteLogger = createLogger();
  const logWithPrefix = (fn: (msg: string) => void) => (msg: string) =>
    fn(`${picocolors.bgYellow('Vite')} ${msg}`);

  customViteLogger.error = logWithPrefix(logger.error);
  customViteLogger.warn = logWithPrefix(logger.warn);
  customViteLogger.warnOnce = (msg) => {
    if (seenWarnings.has(msg)) {
      return;
    }
    seenWarnings.add(msg);
    logWithPrefix(logger.warn)(msg);
  };
  customViteLogger.info = logWithPrefix((msg) => logger.log(msg, { spacing: 0 }));

  return customViteLogger;
}
