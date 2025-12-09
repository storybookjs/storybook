import { writeFileSync } from 'node:fs';
import process from 'node:process';

// @ts-expect-error no types!
import npmpkg from 'npm-registry-client';

type AuthOptions = {
  username: string;
  password: string;
  email: string;
  registry: string;
};

/**
 * Authenticates to the npm registry and writes a .npmrc to the specified directory. Code is based
 * on the (unmaintained) npm-auth-to-token package
 *
 * @param opts - The authentication options.
 * @returns Promise<void>
 */
export function npmAuth(opts: AuthOptions & { outputDir?: string }): Promise<void> {
  const { username, password, email, registry, outputDir } = opts;
  const client = new (npmpkg as any)();

  return new Promise((resolve, reject) => {
    client.adduser(
      registry,
      {
        auth: {
          username,
          password,
          email,
          alwaysAuth: true,
        },
      },
      (err: Error | null, res: { token: string }) => {
        if (err) {
          return reject(err);
        }
        const path = `${outputDir || process.cwd()}/.npmrc`;
        let base = registry.substring(registry.indexOf('/'));
        if (base.lastIndexOf('/') !== registry.length - 1) {
          base += '/';
        }
        writeFileSync(path, `registry=${registry}\n${base}:_authToken=${res.token}`);

        console.log('Done');
        resolve();
      }
    );
  });
}
