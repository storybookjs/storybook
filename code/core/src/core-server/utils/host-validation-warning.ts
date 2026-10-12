import { cache, isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import type { CoreConfig } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

const DOCS_URL = 'https://storybook.js.org/docs/api/main-config/main-config-core#allowedhosts';

export type HostValidationWarningOptions = {
  host?: string;
  allowedHosts?: CoreConfig['allowedHosts'];
  ci?: boolean;
  smokeTest?: boolean;
  cacheKey: string;
};

export type HostValidationWarning = {
  id: 'allowed-hosts' | 'all-interfaces';
  message: string;
};

export const getHostValidationWarning = ({
  host,
  allowedHosts,
}: Pick<HostValidationWarningOptions, 'host' | 'allowedHosts'>):
  | HostValidationWarning
  | undefined => {
  if (allowedHosts === true) {
    return {
      id: 'allowed-hosts',
      message: dedent`
        Host validation is disabled because core.allowedHosts is set to true.
        Any website open in your browser can send requests to this Storybook.
        Such a website can read your stories and source files. It can also write files in your project through the WebSocket channel.

        Set core.allowedHosts to a list of hostnames in .storybook/main.ts to restrict access.
        Learn more: ${DOCS_URL}
      `,
    };
  }
  if (host === '0.0.0.0' && (!allowedHosts || allowedHosts.length === 0)) {
    return {
      id: 'all-interfaces',
      message: dedent`
        Storybook is listening on all network interfaces because --host is set to 0.0.0.0.
        Anyone on your network can open this Storybook. They can read your stories and source files, and they can write files in your project through the WebSocket channel.

        Remove --host 0.0.0.0 to listen on localhost only. Also set core.allowedHosts to a list of hostnames in .storybook/main.ts to keep host validation enabled.
        Learn more: ${DOCS_URL}
      `,
    };
  }
  return undefined;
};

const isInteractiveTerminal = () => Boolean(process.stdin.isTTY && process.stdout.isTTY) && !isCI();

export async function warnOnDisabledHostValidation(options: HostValidationWarningOptions) {
  const warning = getHostValidationWarning(options);
  if (!warning) {
    return;
  }

  logger.warn(warning.message);
  if (options.ci || options.smokeTest || !isInteractiveTerminal()) {
    return;
  }

  const skipPromptKey = `host-validation-prompt-skipped-${warning.id}-${options.cacheKey}`;
  if (await cache.get(skipPromptKey).catch(() => false)) {
    return;
  }

  const choice = await prompt.select<'continue' | 'dont-ask' | 'abort'>({
    message: 'How do you want to proceed?',
    options: [
      {
        value: 'continue',
        label: 'Continue',
        hint: 'Start Storybook with host validation disabled',
      },
      {
        value: 'dont-ask',
        label: "Continue and don't ask again",
        hint: 'Start Storybook and skip this question in the future',
      },
      { value: 'abort', label: 'Abort' },
    ],
    initialValue: 'continue',
  });

  if (choice === 'abort') {
    process.exit(1);
  }
  if (choice === 'dont-ask') {
    await cache.set(skipPromptKey, true).catch(() => {});
  }
}
