import { once } from 'storybook/internal/client-logger';
import { DocumentBodyHasIdError } from 'storybook/internal/preview-errors';
import type { StoryId } from 'storybook/internal/types';

const STORY_ROOT_ID = 'storybook-root';

/**
 * Marks the `<body>` that the render of a story that owns the document left as its root,
 * `#storybook-root`, and returns the function that takes the mark back.
 */
export const markDocumentRoot = (storyId: StoryId) => {
  const { body } = document;
  if (body.id && body.id !== STORY_ROOT_ID) {
    once.warn(String(new DocumentBodyHasIdError({ storyId, id: body.id })));
    return () => {};
  }

  body.id = STORY_ROOT_ID;
  // A client render that acquires <body> again on the same node strips its attributes. A body that
  // replaces this one is the next render's to mark: marking it before it hydrates would put the id
  // into the hydration.
  const observer = new MutationObserver(() => {
    if (!body.id) {
      body.id = STORY_ROOT_ID;
    }
  });
  observer.observe(body, { attributes: true, attributeFilter: ['id'] });

  return () => {
    observer.disconnect();
    if (body.id === STORY_ROOT_ID) {
      body.removeAttribute('id');
    }
  };
};
