import { global } from '@storybook/global';

export const deepElementFromPoint = (x: number, y: number) => {
  const element = global.document.elementFromPoint(x, y) as HTMLElement;

  const crawlShadows = (node: HTMLElement): HTMLElement => {
    if (node && node.shadowRoot) {
      // elementFromPoint() doesn't exist in ShadowRoot type
      const nestedElement = (node.shadowRoot as any).elementFromPoint(x, y);

      // Nested node is same as the root one
      if (node.isEqualNode(nestedElement)) {
        return node;
      }
      // The nested node has shadow DOM too so continue crawling
      if (nestedElement.shadowRoot) {
        return crawlShadows(nestedElement);
      }
      // No more shadow DOM
      return nestedElement;
    }

    return node;
  };

  const shadowElement = crawlShadows(element);

  return shadowElement || element;
};
