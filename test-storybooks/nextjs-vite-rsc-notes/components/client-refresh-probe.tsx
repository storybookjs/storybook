"use client";

import { useRouter } from "next/navigation";

export function ClientRefreshProbe() {
  const router = useRouter();

  return (
    <button type="button" onClick={() => router.refresh()}>
      Refresh router
    </button>
  );
}
