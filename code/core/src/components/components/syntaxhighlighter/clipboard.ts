import { global } from '@storybook/global';

const { document, window: globalWindow } = global;

async function copyUsingClipboardAPI(text: string) {
  try {
    await globalWindow.top?.navigator.clipboard.writeText(text);
  } catch {
    await globalWindow.navigator.clipboard.writeText(text);
  }
}

async function copyUsingWorkAround(text: string) {
  const tmp = document.createElement('TEXTAREA') as HTMLTextAreaElement;
  const focus = document.activeElement as HTMLTextAreaElement;

  tmp.value = text;

  document.body.appendChild(tmp);
  tmp.select();
  document.execCommand('copy');
  document.body.removeChild(tmp);
  focus.focus();
}

export function createCopyToClipboardFunction() {
  return globalWindow.navigator?.clipboard ? copyUsingClipboardAPI : copyUsingWorkAround;
}
