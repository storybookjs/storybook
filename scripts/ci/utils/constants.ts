/**
 * This is the root directory for Linux CI jobs.
 *
 * Windows CI jobs use a different root directory!
 *
 * @example /tmp/project/code
 *
 * @example C:\Users\circleci\project\code
 *
 * @example /tmp/storybook-sandboxes
 *
 * @example C:\Users\circleci\storybook-sandboxes
 *
 * To ensure the correct paths are used across config generation, we use the following constants.
 */
export const ROOT_DIR = '/tmp';
export const WORKING_DIR = `project`;
export const SANDBOX_DIR = `storybook-sandboxes`;
