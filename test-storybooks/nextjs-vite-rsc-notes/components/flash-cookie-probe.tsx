import { cookies, headers } from "next/headers";

export default async function FlashCookieProbe() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const flash = cookieStore.get("flash")?.value || "empty";
  const flashValues = cookieStore
    .getAll("flash")
    .map((cookie) => cookie.value)
    .filter(Boolean);
  const requestId = headersList.get("x-test-request") ?? "missing";

  return (
    <section>
      <p>request id: {requestId}</p>
      <p>flash: {flash}</p>
      <p>flash values: {flashValues.join(",") || "empty"}</p>
      <p>has flash: {String(cookieStore.has("flash"))}</p>
      <form
        action={async () => {
          "use server";

          const actionCookieStore = await cookies();
          actionCookieStore.set("flash", "saved", { httpOnly: true, path: "/" });
        }}
      >
        <button>Set flash</button>
      </form>
      <form
        action={async () => {
          "use server";

          const actionCookieStore = await cookies();
          actionCookieStore.delete("flash");
        }}
      >
        <button>Delete flash</button>
      </form>
    </section>
  );
}
