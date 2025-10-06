import { optionalEnvToBoolean } from '../../common/utils/envs';
import type { PromptProvider } from './prompt-provider-base';
import { ClackPromptProvider } from './prompt-provider-clack';
import { PromptsPromptProvider } from './prompt-provider-prompts';

type PromptLibrary = 'clack' | 'prompts';

const PROVIDERS = {
  clack: new ClackPromptProvider(),
  prompts: new PromptsPromptProvider(),
} as const;

let currentPromptLibrary: PromptLibrary = optionalEnvToBoolean(process.env.USE_CLACK)
  ? 'clack'
  : 'prompts';

export const setPromptLibrary = (library: PromptLibrary): void => {
  currentPromptLibrary = library;
};

export const getPromptLibrary = (): PromptLibrary => {
  return currentPromptLibrary;
};

export const getPromptProvider = (): PromptProvider => {
  return PROVIDERS[currentPromptLibrary];
};

export const isClackEnabled = (): boolean => {
  return currentPromptLibrary === 'clack';
};

export const isPromptsEnabled = (): boolean => {
  return currentPromptLibrary === 'prompts';
};

/**
 * Returns the preferred stdio for the current prompt library.
 *
 * Clack handles stdio output so that it clears it out later, and therefore 'pipe' is better. For
 * prompts, we want to inherit the stdio so that the output is displayed in the terminal.
 */
export const getPreferredStdio = (): 'inherit' | 'pipe' => {
  return isClackEnabled() ? 'pipe' : 'inherit';
};
