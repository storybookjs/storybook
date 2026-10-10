import addonDocs from "@storybook/addon-docs";
import { createElement } from "react";
import { definePreview } from "@storybook/nextjs-vite-rsc";
import { drizzle } from "drizzle-orm/pglite";
import { mocked, sb } from "storybook/test";
import { resetDatabase } from "#.storybook/database.ts";
import { fontVariables } from "#app/fonts.ts";
import * as schema from "#db/schema.ts";
import { auth } from "#lib/auth.ts";
import * as authSessionModule from "#lib/auth-session.ts";
import * as dbModule from "#lib/db.ts";
import * as flashCookieModule from "#lib/flash-cookie.ts";
// The styles of the app, which its root layout imports, for a story of a
// component, which renders without the layouts.
import "../app/globals.css";

// The modules that the stories mock, with the files in lib/__mocks__. The
// preview is the rsc layer of the app, so these
// are the modules that the Server Components, the Server Actions and the
// route handlers import. By a relative path: `sb.mock()` resolves it from
// Storybook's own package, which does not know the `imports` of this one.
sb.mock(import("../lib/db.ts"));
// What `#lib/db.ts` is in a dev server: see lib/__mocks__/db.dev.ts.
sb.mock(import("../lib/db.dev.ts"));
sb.mock(import("../lib/auth.ts"));
sb.mock(import("../lib/auth-session.ts"));
sb.mock(import("../lib/flash-cookie.ts"));

const { resetDb } = dbModule as typeof import("#lib/__mocks__/db.ts");
const { setCurrentUser } = authSessionModule as typeof import("#lib/__mocks__/auth-session.ts");
const { deleteFlashCookies } = flashCookieModule as typeof import("#lib/__mocks__/flash-cookie.ts");

export default definePreview({
  addons: [addonDocs()],
  // A story of a component renders with some room around it. A page story,
  // which owns the document, has `layout: "fullscreen"`.
  parameters: { layout: "padded" },
  // The fonts of the app, which its root layout sets on the document, for a
  // story of a component: a Server Component around every story.
  decorators: [
    (Story) =>
      createElement(
        "div",
        { className: `${fontVariables} font-sans text-foreground antialiased` },
        createElement(Story),
      ),
  ],
  // Before every story: nobody signed in, no flash cookies, and an empty
  // database. A story seeds it in its own `beforeEach`.
  async beforeEach() {
    // A mock of `#lib/auth.ts` that a story changed answers as it did.
    for (const spy of Object.values(auth.api)) mocked(spy).mockReset();
    setCurrentUser(null);
    deleteFlashCookies();
    // The one database of the tab, emptied: see database.ts.
    resetDb(drizzle(await resetDatabase(), { schema }));
  },
});
