export function createCopyToClipboardFunction() {
  if (globalWindow.navigator?.clipboard) {
    return async (text: string) => {
      try {
        await globalWindow.top?.navigator.clipboard.writeText(text);
      } catch {
        await globalWindow.navigator.clipboard.writeText(text);
      }
    };
  }
  return async (text: string) => {
    const tmp = document.createElement('TEXTAREA') as HTMLTextAreaElement;
    const focus = document.activeElement as HTMLTextAreaElement;

    tmp.value = text;

    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
    focus.focus();
  };
}
