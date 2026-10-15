interface PrintedAttribute {
  name: string;
  value: unknown;
  viaField?: boolean;
}

export function escapeAttribute(value: string, quote: '"' | "'" = '"'): string {
  const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return quote === "'" ? escaped.replace(/'/g, '&#39;') : escaped.replace(/"/g, '&quot;');
}

/**
 * A script after the element that adds each listener to it, as the html of a lit template, so its
 * code is escaped for one.
 */
export function printRootListenerScript(
  listeners: { event: string; handler: string }[]
): string | undefined {
  const uniqueListeners = uniqueListenersByEvent(listeners);
  if (uniqueListeners.length === 0) {
    return undefined;
  }
  const lines = uniqueListeners.map(
    ({ event, handler }) =>
      `    host.addEventListener('${escapeScriptString(event)}', ${sanitizeScriptHandler(handler)});`
  );
  return `<script>
  {
    const host = document.currentScript.previousElementSibling;
${lines.join('\n')}
  }
</script>`
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

const uniqueListenersByEvent = (
  listeners: { event: string; handler: string }[]
): { event: string; handler: string }[] => {
  const events = new Set<string>();
  return listeners.filter(({ event }) => {
    if (events.has(event)) {
      return false;
    }
    events.add(event);
    return true;
  });
};

export function printAttribute({ name, value, viaField }: PrintedAttribute): string | undefined {
  if (value === true) {
    return name;
  }
  if (value === '') {
    return viaField ? `${name}=""` : undefined;
  }
  if (value === false || value === null || value === undefined) {
    return undefined;
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `${name}="${escapeAttribute(text)}"`;
}

const escapeScriptString = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\x3C');

const sanitizeScriptHandler = (value: string): string =>
  value
    .replace(/<!--/g, '<\\!--')
    .replace(/<script/gi, '<\\script')
    .replace(/<\/script/gi, '<\\/script');
