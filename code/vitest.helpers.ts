import { platform } from 'node:os';

const WINDOWS_PLATFORM = 'win32';
// Implement these whenever needed...
// const MACOS_PLATFORM = 'darwin';
// const LINUX_PLATFORM = 'linux';

let currentPlatform: NodeJS.Platform;

const getPlatform = () => {
  if (!currentPlatform) {
    currentPlatform = platform();
  }

  return currentPlatform;
};

function skipOn(platfm: NodeJS.Platform) {
  return (fn: Function) => {
    if (getPlatform() !== platfm) {
      fn();
    }
  };
}

function onlyOn(platfm: NodeJS.Platform) {
  return (fn: Function) => {
    if (getPlatform() === platfm) {
      fn();
    }
  };
}

export const IS_WINDOWS = getPlatform() === WINDOWS_PLATFORM;
export const skipWindows = skipOn(WINDOWS_PLATFORM);
export const onlyWindows = onlyOn(WINDOWS_PLATFORM);
