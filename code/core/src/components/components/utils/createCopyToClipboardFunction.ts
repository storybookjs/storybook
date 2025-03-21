export function createCopyToClipboardFunction() {
  if (navigator?.clipboard) {
    return (text: string) => navigator.clipboard.writeText(text);
  }

  return async (text: string) => {
    const tmp = document.createElement('textarea');
    const focus = document.activeElement;

    tmp.value = text;

    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);

    if (focus instanceof HTMLElement) {
      focus.focus();
    }
  };
}
