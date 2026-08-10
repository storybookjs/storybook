import { cookies, headers } from "next/headers";

export default async function Component() {
  async function handleClick() {
    "use server";
    cookies().set("user-id", "encrypted-id");
  }

  return (
    <>
      <h3>Cookies:</h3>
      {cookies()
        .getAll()
        .map(({ name, value }) => {
          return (
            <p
              key={name}
              style={{ display: "flex", flexDirection: "row", gap: 8 }}
            >
              <strong>Name:</strong> <span>{name}</span>
              <strong>Value:</strong> <span>{value}</span>
            </p>
          );
        })}

      <h3>Headers:</h3>
      {Array.from(headers().entries()).map(
        ([name, value]: [string, string]) => {
          return (
            <p
              key={name}
              style={{ display: "flex", flexDirection: "row", gap: 8 }}
            >
              <strong>Name:</strong> <span>{name}</span>
              <strong>Value:</strong> <span>{value}</span>
            </p>
          );
        },
      )}

      <form action={handleClick}>
        <button type="submit">add user-id cookie</button>
      </form>
    </>
  );
}
