export function enhance(form: HTMLFormElement) {
  const listener = (...args: any[]) => {
    const e = args[0];
    e.preventDefault();
    const event = new CustomEvent('storybook:enhance', {
      detail: args,
    });
    window.dispatchEvent(event);
  };
  form.addEventListener('submit', listener);
  return {
    destroy() {
      form.removeEventListener('submit', listener);
    },
  };
}

export function applyAction() {}

export function deserialize() {}
