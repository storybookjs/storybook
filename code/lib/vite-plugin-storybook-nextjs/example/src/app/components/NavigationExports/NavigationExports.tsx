"use client";

import {
  ReadonlyURLSearchParams,
  RedirectType,
  ServerInsertedHTMLContext,
} from "next/navigation";
import { useContext } from "react";

/**
 * Guards the statically analysable export surface of the `next/navigation` mock: these
 * members are pass-throughs to Next.js' CommonJS implementation, which only `export *`
 * covered before storybookjs/storybook#34688.
 */
export default function NavigationExports() {
  const serverInsertedHTML = useContext(ServerInsertedHTMLContext);
  const searchParams = new ReadonlyURLSearchParams(
    new URLSearchParams("?framework=storybook"),
  );

  return (
    <dl>
      <dt>ServerInsertedHTMLContext</dt>
      <dd data-testid="server-inserted-html-context">
        {serverInsertedHTML === null ? "resolved" : "resolved (with provider)"}
      </dd>

      <dt>ReadonlyURLSearchParams</dt>
      <dd data-testid="readonly-url-search-params">
        {searchParams.get("framework")}
      </dd>

      <dt>RedirectType</dt>
      <dd data-testid="redirect-type">{RedirectType.push}</dd>
    </dl>
  );
}
