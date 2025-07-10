import { nodeLogger } from 'storybook/internal/node';

export const CLI_COLORS: typeof nodeLogger.CLI_COLORS = nodeLogger.CLI_COLORS;
export const colors: typeof nodeLogger.colors = nodeLogger.colors;
export const logger: typeof nodeLogger.logger = nodeLogger.logger;
export const instance: typeof nodeLogger.instance = nodeLogger.instance;
export const once: typeof nodeLogger.once = nodeLogger.once;
export const logTracker: typeof nodeLogger.logTracker = nodeLogger.logTracker;
export const prompt: typeof nodeLogger.prompt = nodeLogger.prompt;
export const protectUrls: typeof nodeLogger.protectUrls = nodeLogger.protectUrls;
export const createHyperlink: typeof nodeLogger.createHyperlink = nodeLogger.createHyperlink;
export const deprecate: typeof nodeLogger.deprecate = nodeLogger.deprecate;

export type SpinnerInstance = nodeLogger.SpinnerInstance;
export type TaskLogInstance = nodeLogger.TaskLogInstance;
