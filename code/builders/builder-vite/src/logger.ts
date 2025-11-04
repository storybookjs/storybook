import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

export async function createViteLogger() {
  const { createLogger } = await import('vite');

  const customViteLogger = createLogger();
  const logWithPrefix = (fn: (msg: string) => void) => (msg: string) =>
    fn(`${picocolors.bgYellow('Vite')} ${msg}`);

  customViteLogger.error = logWithPrefix(logger.error);
  customViteLogger.warn = logWithPrefix(logger.warn);
  customViteLogger.warnOnce = logWithPrefix(logger.warn);
  customViteLogger.info = logWithPrefix((msg) => logger.log(msg, { spacing: 0 }));

  return customViteLogger;
}
