import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

export const commandLog = (message: string) => {
  process.stdout.write(picocolors.cyan(' • ') + message);

  // Need `void` to be able to use this function in a then of a Promise<void>
  return (errorMessage?: string | void, errorInfo?: string) => {
    if (errorMessage) {
      process.stdout.write(`. ${picocolors.red('✖')}\n`);
      logger.error(`\n     ${picocolors.red(errorMessage)}`);

      if (!errorInfo) {
        return;
      }

      const newErrorInfo = errorInfo
        .split('\n')
        .map((line) => `     ${picocolors.dim(line)}`)
        .join('\n');
      logger.error(`${newErrorInfo}\n`);
      return;
    }

    process.stdout.write(`. ${picocolors.green('✓')}\n`);
  };
};

export function paddedLog(message: string) {
  const newMessage = message
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');

  logger.log(newMessage);
}

export function getChars(char: string, amount: number) {
  let line = '';
  for (let lc = 0; lc < amount; lc += 1) {
    line += char;
  }

  return line;
}

export function codeLog(codeLines: string[], leftPadAmount?: number) {
  let maxLength = 0;
  const newLines = codeLines.map((line) => {
    maxLength = line.length > maxLength ? line.length : maxLength;
    return line;
  });

  const finalResult = newLines
    .map((line) => {
      const rightPadAmount = maxLength - line.length;
      let newLine = line + getChars(' ', rightPadAmount);
      newLine = getChars(' ', leftPadAmount || 2) + picocolors.inverse(` ${newLine} `);
      return newLine;
    })
    .join('\n');

  logger.log(finalResult);
}
