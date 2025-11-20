const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Collapse empty Angular component tags to self-closing form when Angular >= 16. Keeps real HTML
 * void tags intact. Conservatively avoids collapsing common HTML tags.
 */
export function collapseEmptyAngularTags(html: string): string {
  if (!html || !html.includes('</')) {
    return html;
  }

  return html.replace(
    /<([a-zA-Z][\w-]*)([^>]*)>([\t\r\n ]*)<\/\1>/g,
    (m: string, tag: string, attrs: string, inner: string) => {
      // If there is any inner content, including whitespace/newlines, keep as-is
      if (inner && inner.length > 0) return m;
      const name = tag.toLowerCase();
      if (VOID_TAGS.has(name)) return m; // don't touch voids
      // Collapse custom elements (with a dash) and unknown tags; skip common built-ins
      if (name.includes('-')) return `<${tag}${attrs} />`;
      const standard = new Set([
        'div',
        'span',
        'p',
        'a',
        'button',
        'ul',
        'li',
        'ol',
        'section',
        'article',
        'main',
        'header',
        'footer',
        'nav',
        'label',
        'form',
        'table',
        'thead',
        'tbody',
        'tr',
        'td',
        'th',
        'svg',
        'path',
        'g',
      ]);
      return standard.has(name) ? m : `<${tag}${attrs} />`;
    }
  );
}
