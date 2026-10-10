"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

export function NextRouterProbe() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <section>
      <p>pathname: {pathname}</p>
      <p>search q: {searchParams.get("q")}</p>
      <p>search q all: {searchParams.getAll("q").join(",")}</p>
      <p>search has missing: {String(searchParams.has("missing"))}</p>
      <p>params: {JSON.stringify(params)}</p>
      <button type="button" onClick={() => router.push(`${pathname}?q=pushed`)}>
        Push search
      </button>
      <button type="button" onClick={() => router.replace(`${pathname}?q=replaced`)}>
        Replace search
      </button>
      <Link href={{ pathname: "/auth/sign-in", query: { q: "linked" } }} prefetch={false}>
        Link route
      </Link>
    </section>
  );
}
